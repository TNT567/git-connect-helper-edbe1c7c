import React, { useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useChainConfig } from '../state/useChainConfig'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { ContractPromise } from '@polkadot/api-contract'
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp'
import { BACKEND_URL } from '../config/backend'

type MintState = 'idle' | 'sending' | 'in-block' | 'finalized' | 'success' | 'error'

export default function MintConfirm() {
  const [params] = useSearchParams()
  const code = useMemo(() => params.get('code') ?? '', [params])
  const bookIdRaw = useMemo(() => params.get('book_id') ?? '', [params])
  const ar = useMemo(() => params.get('ar') ?? '', [params])
  const [state, setState] = useState<MintState>('idle')
  const [message, setMessage] = useState<string>('')
  const { config } = useChainConfig()
  const navigate = useNavigate()

  const buildSuccessPath = () => {
    const qs: string[] = []
    if (bookIdRaw) qs.push(`book_id=${encodeURIComponent(bookIdRaw)}`)
    if (ar) qs.push(`ar=${encodeURIComponent(ar)}`)
    return `/success${qs.length ? `?${qs.join('&')}` : ''}`
  }

  const handleMint = async () => {
    if (!code) {
      setState('error')
      setMessage('未获取到 Secret Code')
      return
    }
    if (!config.contractAddress || !config.abiUrl) {
      setState('error')
      setMessage('未配置合约地址或 ABI')
      return
    }
    try {
      setState('sending')
      setMessage('')
      const provider = new WsProvider(config.endpoint)
      const api = await ApiPromise.create({ provider })
      const exts = await web3Enable('Whale Vault DApp')
      if (!exts || exts.length === 0) {
        setState('error')
        setMessage('未检测到钱包扩展')
        return
      }
      let address = ''
      try {
        address = localStorage.getItem('selectedAddress') || ''
      } catch {}
      if (!address) {
        const accs = await web3Accounts()
        address = accs[0]?.address ?? ''
      }
      if (!address) {
        setState('error')
        setMessage('未找到账户')
        return
      }
      const injector = await web3FromAddress(address)
      const res = await fetch(config.abiUrl)
      const abi = await res.json()
      const contract = new ContractPromise(api, abi, config.contractAddress)
      const queryRes = await contract.query.mint(address, { value: 0, gasLimit: -1, storageDepositLimit: null }, code)
      if (queryRes.result.isErr) {
        setState('error')
        setMessage('模拟执行失败')
        return
      }
      const gas = queryRes.gasRequired
      const stor = queryRes.storageDeposit?.isCharge ? queryRes.storageDeposit.asCharge : null
      const tx = contract.tx.mint({ value: 0, gasLimit: gas, storageDepositLimit: stor }, code)
      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(address, { signer: injector.signer }, (result) => {
          if (result.status.isInBlock) {
            setState('in-block')
            setMessage(`已进入区块 ${result.status.asInBlock.toString()}`)
          } else if (result.status.isFinalized) {
            const failed = result.events.some(({ event }) => event.section === 'system' && event.method === 'ExtrinsicFailed')
            if (failed) {
              setState('error')
              setMessage('交易失败')
              reject(new Error('ExtrinsicFailed'))
            } else {
              setState('success')
              setMessage(`已最终确认 ${result.status.asFinalized.toString()}`)
              navigate(buildSuccessPath())
              resolve()
            }
          }
        }).catch((e) => {
          reject(e)
        })
      })
    } catch (e) {
      setState('error')
      setMessage('发送失败')
    }
  }

  const handleMintGasless = async () => {
    if (!code) {
      setState('error')
      setMessage('未获取到 Secret Code')
      return
    }
    try {
      setState('sending')
      setMessage('')
      const provider = new WsProvider(config.endpoint)
      const api = await ApiPromise.create({ provider })
      const exts = await web3Enable('Whale Vault DApp')
      if (!exts || exts.length === 0) {
        setState('error')
        setMessage('未检测到钱包扩展')
        return
      }
      let address = ''
      try {
        address = localStorage.getItem('selectedAddress') || ''
      } catch {}
      if (!address) {
        const accs = await web3Accounts()
        address = accs[0]?.address ?? ''
      }
      if (!address) {
        setState('error')
        setMessage('未找到账户')
        return
      }
      const injector = await web3FromAddress(address)
      const res = await fetch(config.abiUrl)
      const abi = await res.json()
      const contract = new ContractPromise(api, abi, config.contractAddress)
      const nonce = Math.floor(Math.random() * 1e9)
      const deadline = Math.floor(Date.now() / 1000) + 600
      const msg = new TextEncoder().encode(`mint_meta|${address}|${code}|${nonce}|${deadline}`)
      const hex = '0x' + Array.from(msg).map(b => b.toString(16).padStart(2, '0')).join('')
      const signed = await injector.signer.signRaw({ address, data: hex, type: 'bytes' })
      const signature = signed.signature
      const queryRes = await contract.query.mint_meta(address, { value: 0, gasLimit: -1, storageDepositLimit: null }, address, code, signature, nonce, deadline)
      if (queryRes.result.isErr) {
        setState('error')
        setMessage('模拟执行失败')
        return
      }
      const gas = queryRes.gasRequired
      const stor = queryRes.storageDeposit?.isCharge ? queryRes.storageDeposit.asCharge : null
      const call = contract.tx.mint_meta({ value: 0, gasLimit: gas, storageDepositLimit: stor }, address, code, signature, nonce, deadline)
      const callData = call.method.toHex()
      const payload = {
        dest: config.contractAddress,
        value: '0',
        gasLimit: gas.toString(),
        storageDepositLimit: stor ? stor.toString() : null,
        dataHex: callData,
        signer: address
      }
      const url = `${BACKEND_URL}/relay/mint${bookIdRaw ? `?book_id=${encodeURIComponent(bookIdRaw)}` : ''}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!resp.ok) {
        setState('error')
        setMessage('后端处理失败')
        return
      }
      const { status, txHash } = await resp.json()
      if (status === 'submitted') {
        setState('in-block')
        setMessage(`已提交，交易哈希 ${txHash || ''}`)
        navigate(buildSuccessPath())
      } else {
        setState('error')
        setMessage('提交失败')
      }
    } catch {
      setState('error')
      setMessage('免 Gas 流程失败')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold mb-2">Mint 确认</h1>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/70 mb-4">Secret Code</p>
        <p className="text-base font-mono break-all">{code || '未识别到 Code'}</p>
        <div className="mt-6 flex items-center gap-3">
          <button
            className="rounded-lg bg-accent/30 hover:bg-accent/50 border border-accent/50 px-4 py-2 transition shadow-glow"
            onClick={handleMint}
            disabled={state === 'sending' || state === 'in-block'}
          >
            {state === 'sending' ? '发送中...' : state === 'in-block' ? '区块确认中...' : '确认 Mint'}
          </button>
          <button
            className="rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 transition shadow-glow"
            onClick={handleMintGasless}
            disabled={state === 'sending'}
          >
            免 Gas 铸造
          </button>
          {message && <span className="text-sm text-white/70">{message}</span>}
        </div>
      </div>
    </div>
  )
}
