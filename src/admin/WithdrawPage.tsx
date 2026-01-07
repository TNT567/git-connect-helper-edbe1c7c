import React, { useEffect, useState } from 'react'
import { useChainConfig } from '../state/useChainConfig'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { ContractPromise } from '@polkadot/api-contract'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'
import confetti from 'canvas-confetti'

type WithdrawState = 'idle' | 'sending' | 'in-block' | 'success' | 'error'

export default function WithdrawPage() {
  const { config } = useChainConfig()
  const [state, setState] = useState<WithdrawState>('idle')
  const [message, setMessage] = useState<string>('')
  const [txHash, setTxHash] = useState<string>('')
  const [withdrawable, setWithdrawable] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const loadWithdrawable = async (providedAddress?: string) => {
    if (!config.contractAddress || !config.abiUrl) {
      setWithdrawable(null)
      return
    }
    try {
      setBalanceLoading(true)
      let address = providedAddress || ''
      const provider = new WsProvider(config.endpoint)
      const api = await ApiPromise.create({ provider })
      try {
        const exts = await web3Enable('Whale Vault DApp')
        if (!exts || exts.length === 0) {
          setWithdrawable(null)
          return
        }
        if (!address) {
          try {
            address = localStorage.getItem('selectedAddress') || ''
          } catch {}
        }
        if (!address) {
          const accs = await web3Accounts()
          address = accs[0]?.address ?? ''
        }
        if (!address) {
          setWithdrawable(null)
          return
        }
        const res = await fetch(config.abiUrl)
        const abi = await res.json()
        const contract = new ContractPromise(api, abi, config.contractAddress)
        const queryFn = (contract.query as any)['get_withdrawable']
        if (!queryFn) {
          setWithdrawable(null)
          return
        }
        const query = await queryFn(address, {
          value: 0,
          gasLimit: -1,
          storageDepositLimit: null
        })
        if (query.result.isErr) {
          setWithdrawable(null)
          return
        }
        const out = query.output?.toJSON() as any
        const val =
          out && typeof out === 'object' && ('ok' in out || 'Ok' in out)
            ? out.ok ?? out.Ok
            : out
        setWithdrawable(val != null ? String(val) : '0')
      } finally {
        api.disconnect()
      }
    } catch {
      setWithdrawable(null)
    } finally {
      setBalanceLoading(false)
    }
  }

  useEffect(() => {
    loadWithdrawable()
  }, [config])

  const handleWithdraw = async () => {
    if (!config.contractAddress || !config.abiUrl) {
      setState('error')
      setMessage('未配置合约地址或 ABI')
      return
    }
    try {
      setState('sending')
      setMessage('')
      setTxHash('')
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
      const query = await contract.query.pull_funds(address, { value: 0, gasLimit: -1, storageDepositLimit: null })
      if (query.result.isErr) {
        setState('error')
        setMessage('模拟执行失败')
        return
      }
      const gas = query.gasRequired
      const stor = query.storageDeposit?.isCharge ? query.storageDeposit.asCharge : null
      const tx = contract.tx.pull_funds({ value: 0, gasLimit: gas, storageDepositLimit: stor })
      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(address, { signer: injector.signer }, (result) => {
          if (result.status.isInBlock) {
            setState('in-block')
            setMessage(`已进入区块 ${result.status.asInBlock.toString()}`)
            setTxHash(result.status.asInBlock.toString())
          } else if (result.status.isFinalized) {
            const failed = result.events.some(
              ({ event }) => event.section === 'system' && event.method === 'ExtrinsicFailed'
            )
            if (failed) {
              setState('error')
              setMessage('提现失败')
              reject(new Error('ExtrinsicFailed'))
            } else {
              setState('success')
              setMessage(`已最终确认 ${result.status.asFinalized.toString()}`)
              setTxHash(result.status.asFinalized.toString())
              try {
                confetti({
                  spread: 70,
                  origin: { y: 0.6 }
                })
              } catch {}
              loadWithdrawable(address)
              resolve()
            }
          }
        }).catch((e) => reject(e))
      })
    } catch {
      setState('error')
      setMessage('提现流程失败')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">财务提现</h1>
        <p className="text-sm text-white/60">通过 Ink! 合约的 pull_funds 方法将可提现余额提取到当前账户。</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4 max-w-xl">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-white/70">
            使用当前连接的钱包地址，对接作者或出版社在合约中的收益账户身份。
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-black/30 border border-white/10 px-4 py-3">
          <div className="text-sm text-white/60">当前地址可提取余额</div>
          <div className="text-lg font-semibold text-emerald-300">
            {balanceLoading ? '读取中...' : withdrawable !== null ? withdrawable : '--'}
          </div>
        </div>
        <button
          className="rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 transition shadow-glow"
          onClick={handleWithdraw}
          disabled={state === 'sending' || state === 'in-block'}
        >
          {state === 'sending' ? '发送中...' : state === 'in-block' ? '区块确认中...' : '立即提现'}
        </button>
        {message && <div className="text-sm text-white/70">{message}</div>}
        {txHash && (
          <div className="text-xs text-white/60 break-all">
            Tx: {txHash}
          </div>
        )}
      </div>
    </div>
  )
}
