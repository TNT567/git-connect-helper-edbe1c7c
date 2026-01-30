import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MOCK_BOOKS, MockBook } from '../data/mockData';
import { ScanVerifyModal } from '../components/ScanVerifyModal';
import { BettingModal } from '../components/BettingModal';
import { ToastContainer } from '../components/ui/CyberpunkToast';

// 语言选项配置
const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: 'ZH' },
  { code: 'ja', label: 'JP' },
  { code: 'ko', label: 'KR' },
  { code: 'ru', label: 'RU' }
];

export default function Bookshelf() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  // 使用 Mock 数据
  const [tickers, setTickers] = useState<MockBook[]>(MOCK_BOOKS);
  const [lastUpdatedIndex, setLastUpdatedIndex] = useState<number | null>(null);
  
  // Modal 状态
  const [showScanModal, setShowScanModal] = useState(false);
  const [showBettingModal, setShowBettingModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<MockBook | null>(null);

  // 模拟"终焉大盘"实时波动逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * tickers.length);
      
      setTickers(prev => prev.map((item, idx) => {
        if (idx === randomIndex) {
          const increment = Math.floor(Math.random() * 50) + 1;
          const newSales = item.sales + increment;
          const currentChange = parseFloat(item.change);
          const newChangeVal = (currentChange + (Math.random() * 0.1 - 0.02)).toFixed(2);
          
          return { 
            ...item, 
            sales: newSales,
            currentPrice: newSales,
            predictionPool: item.predictionPool + Math.floor(Math.random() * 100),
            change: `${parseFloat(newChangeVal) > 0 ? '+' : ''}${newChangeVal}%` 
          };
        }
        return item;
      }));

      setLastUpdatedIndex(randomIndex);
      setTimeout(() => setLastUpdatedIndex(null), 800);
    }, 2000);

    return () => clearInterval(interval);
  }, [tickers.length]);

  // 根据当前语言渲染标题
  const renderTitle = () => {
    switch(i18n.language) {
      case 'zh': return '鲸之金库';
      case 'ja': return 'ホエール・ヴォルト';
      case 'ko': return '웨일 볼트';
      case 'ru': return 'КИТОВОЕ ХРАНИЛИЩЕ';
      default: return 'WHALE VAULT';
    }
  };

  const handleBookClick = (book: MockBook) => {
    setSelectedBook(book);
    navigate(`/book/${book.id}`);
  };

  const handleBetClick = (e: React.MouseEvent, book: MockBook) => {
    e.stopPropagation();
    setSelectedBook(book);
    setShowBettingModal(true);
  };

  const handleBetPlaced = (amount: number, newPool: number) => {
    if (selectedBook) {
      setTickers(prev => prev.map(book => 
        book.id === selectedBook.id 
          ? { ...book, predictionPool: newPool }
          : book
      ));
    }
  };

  return (
    <div style={styles.container}>
      <ToastContainer />
      
      {/* 顶部行情跑马灯与多语言切换组 */}
      <div style={styles.tickerBar}>
        <div style={styles.tickerContent}>
          <span style={{ color: '#00ffad', fontWeight: 'bold' }}>● {t('market_status') || 'MARKET LIVE'}</span>
          <span style={styles.divider}>|</span>
          <span>{t('network') || 'DEMO MODE'}</span>
          <span style={styles.divider}>|</span>
          <span>{t('index') || 'INDEX'}: <span style={{color: '#fff'}}>{(tickers.reduce((acc, curr) => acc + curr.sales, 0) / 10000).toFixed(2)}K</span></span>
          
          {/* 扫码按钮 */}
          <button
            onClick={() => setShowScanModal(true)}
            style={styles.scanButton}
          >
            📱 Scan QR
          </button>
          
          {/* 语言切换按钮组 */}
          <div style={styles.langButtonGroup}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                style={{
                  ...styles.langToggleBtn,
                  backgroundColor: i18n.language === lang.code ? '#833ab4' : 'transparent',
                  color: i18n.language === lang.code ? '#fff' : '#666',
                  borderColor: i18n.language === lang.code ? '#833ab4' : '#333',
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>
              {renderTitle()}{' '}
              <span style={styles.terminalText}>TERMINAL</span>
            </h1>
            <p style={styles.subtitle}>{t('subtitle') || 'Real-time Book Sales & Prediction Market'}</p>
            <div style={styles.demoBadge}>
              🔧 DEMO MODE - No Backend Required
            </div>
          </div>
        </header>

        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <th style={styles.th}>{t('th_asset') || 'ASSET'}</th>
                <th style={styles.th}>{t('th_title') || 'TITLE'}</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>{t('th_sales') || 'SALES'}</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>POOL</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>{t('th_chg') || 'CHG'}</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>STATUS</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>{t('action_trade') || 'ACTION'}</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((book, index) => (
                <tr 
                  key={book.id} 
                  style={{
                    ...styles.tr,
                    backgroundColor: lastUpdatedIndex === index ? 'rgba(131, 58, 180, 0.15)' : 'transparent',
                  }}
                  onClick={() => handleBookClick(book)}
                >
                  <td style={styles.td}>
                    <div style={styles.symbolBadge}>{book.symbol}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.bookName}>{book.title}</div>
                    <div style={styles.bookAuthor}>{book.author}</div>
                  </td>
                  <td style={{ 
                    ...styles.td, 
                    ...styles.numeric, 
                    color: lastUpdatedIndex === index ? '#00ffad' : '#f0f3fa',
                    transition: 'color 0.3s ease'
                  }}>
                    {book.sales.toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, ...styles.numeric, color: '#a855f7' }}>
                    ${(book.predictionPool / 1000).toFixed(1)}K
                  </td>
                  <td style={{ 
                    ...styles.td, 
                    ...styles.numeric, 
                    color: book.change.startsWith('+') ? '#00ffad' : '#ff4d4d' 
                  }}>
                    {book.change}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: book.verificationStatus === 'Verified Genuine' 
                        ? 'rgba(34, 197, 94, 0.2)' 
                        : 'rgba(239, 68, 68, 0.2)',
                      color: book.verificationStatus === 'Verified Genuine' 
                        ? '#22c55e' 
                        : '#ef4444',
                      borderColor: book.verificationStatus === 'Verified Genuine'
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(239, 68, 68, 0.3)'
                    }}>
                      {book.verificationStatus === 'Verified Genuine' ? '✓' : '⚠️'}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button 
                      style={styles.actionBtn}
                      onClick={(e) => handleBetClick(e, book)}
                    >
                      PREDICT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* 视觉特效层 */}
      <div style={styles.scanline}></div>
      <div style={styles.gridOverlay}></div>

      {/* Modals */}
      <ScanVerifyModal 
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
      />
      
      {selectedBook && (
        <BettingModal
          isOpen={showBettingModal}
          onClose={() => setShowBettingModal(false)}
          book={selectedBook}
          onBetPlaced={handleBetPlaced}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#050505',
    minHeight: '100vh',
    color: '#a0a0a0',
    fontFamily: '"Inter", "Roboto Mono", monospace',
    position: 'relative',
    overflow: 'hidden',
  },
  tickerBar: {
    backgroundColor: '#000',
    borderBottom: '1px solid #1a1a1a',
    padding: '8px 20px',
    fontSize: '11px',
    letterSpacing: '1px',
    zIndex: 10,
    position: 'relative',
  },
  tickerContent: { display: 'flex', gap: '20px', alignItems: 'center' },
  divider: { color: '#333' },
  scanButton: {
    background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
    border: 'none',
    color: '#fff',
    padding: '6px 16px',
    fontSize: '10px',
    fontWeight: 'bold',
    borderRadius: '6px',
    cursor: 'pointer',
    marginLeft: 'auto',
    marginRight: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  langButtonGroup: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#0a0a0a',
    padding: '2px',
    borderRadius: '4px',
    border: '1px solid #1a1a1a'
  },
  langToggleBtn: {
    background: 'none',
    border: '1px solid transparent',
    fontSize: '9px',
    padding: '2px 8px',
    cursor: 'pointer',
    borderRadius: '2px',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
  },
  main: { padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 },
  header: { marginBottom: '40px' },
  title: { color: '#fff', fontSize: '32px', fontWeight: 900, margin: 0, letterSpacing: '-1.5px' },
  terminalText: { 
    color: '#833ab4', 
    textShadow: '0 0 20px rgba(131, 58, 180, 0.6)',
    fontStyle: 'italic'
  },
  subtitle: { fontSize: '14px', color: '#444', margin: '5px 0 0 0', fontWeight: 400 },
  demoBadge: {
    display: 'inline-block',
    marginTop: '10px',
    padding: '6px 12px',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    border: '1px solid rgba(34, 211, 238, 0.3)',
    borderRadius: '6px',
    fontSize: '10px',
    color: '#22d3ee',
    fontWeight: 'bold',
    letterSpacing: '1px'
  },
  tableContainer: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    backdropFilter: 'blur(15px)',
    border: '1px solid #1a1a1a',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  theadRow: { backgroundColor: 'rgba(255,255,255,0.02)' },
  th: { padding: '15px 16px', color: '#444', fontSize: '10px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #1a1a1a', letterSpacing: '1px' },
  td: { padding: '16px', borderBottom: '1px solid #0f0f0f' },
  tr: { transition: 'background-color 0.4s ease', cursor: 'pointer' },
  symbolBadge: { color: '#833ab4', fontWeight: 'bold', border: '1px solid #2a2a2a', padding: '4px 8px', display: 'inline-block', borderRadius: '4px', fontSize: '11px' },
  bookName: { color: '#efefef', fontWeight: 600, fontSize: '14px' },
  bookAuthor: { color: '#555', fontSize: '11px', marginTop: '2px' },
  numeric: { fontFamily: '"Roboto Mono", monospace', textAlign: 'right' },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '1px solid',
    fontSize: '12px'
  },
  actionBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #833ab4',
    color: '#833ab4',
    padding: '6px 16px',
    fontSize: '10px',
    cursor: 'pointer',
    fontWeight: 'bold',
    borderRadius: '4px',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  scanline: {
    width: '100%', height: '2px', zIndex: 5, background: 'rgba(131, 58, 180, 0.05)',
    position: 'absolute', pointerEvents: 'none', top: 0,
    boxShadow: '0 0 10px rgba(131, 58, 180, 0.2)',
  },
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `linear-gradient(#080808 1px, transparent 1px), linear-gradient(90deg, #080808 1px, transparent 1px)`,
    backgroundSize: '30px 30px', zIndex: 0, pointerEvents: 'none',
  }
};
