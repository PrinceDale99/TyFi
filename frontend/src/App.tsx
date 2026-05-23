import React, { useState, useEffect } from 'react';
import {
  Shield,
  Wind,
  CloudRain,
  TrendingUp,
  Wallet,
  Bell,
  Menu,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Lock,
  ArrowUpRight,
  Database,
  Info,
  Calculator,
  MapPin,
  RefreshCw,
  User,
  Plus,
  Loader2,
  Upload,
  DollarSign,
  FileText,
  Sprout,
  X,
  ShieldCheck,
  Phone,
  Heart
} from 'lucide-react';
import FarmerVerification from './components/FarmerVerification';
import WeatherWidget from './components/WeatherWidget';
import MarketWidget from './components/MarketWidget';
import SmartCalculator from './components/SmartCalculator';
import AssetDistribution from './components/AssetDistribution';
import WeatherMap from './components/WeatherMap';
import PayoutStatus from './components/PayoutStatus';
import WalletModal from './components/WalletModal';
import AiCopilot from './components/AiCopilot';
import LedgerStream from './components/LedgerStream';
import { fetchWeather } from './services/weatherService';
import type { WeatherData, FarmData, Claim } from "./types";
import { connectWallet, registerPolicyOnChain, claimPayoutOnChain, getContractTvl, getContractSubsidy, contributeLiquidityOnChain, submitWeatherReportOnChain, getUserLpBalance } from './lib/stellar';
import { calculateCombinedDamage } from './utils/DamageCalculator';
import { useXlmToPhp } from './hooks/useXlmToPhp';
import { WeatherChart } from './components/WeatherChart';
import { estimateCropMetrics } from './services/aiService';
import { PHILIPPINE_REGIONS } from './constants';
import { requestNotificationPermission } from './firebase';
import HistoryDashboard from './components/HistoryDashboard';
import { useTranslation } from 'react-i18next';
import CertificateList from './components/CertificateList';
import SubsidyMarketplace from './components/SubsidyMarketplace';

// Leaflet & React-Leaflet Imports
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';

// Helper components for Leaflet map interaction in the Add Farm modal
const FlyToCenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center[0], center[1], map]);
  return null;
};

const MapEventsHandler = ({ onChange }: { onChange: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

interface Farm extends FarmData {
  id: string;
  isInsured: boolean;
}

function App() {
  const { t, i18n } = useTranslation();
  const { formatPhp } = useXlmToPhp();
  const [stakingMode, setStakingMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [projectionPeriod, setProjectionPeriod] = useState<'1m' | '6m' | '1y'>('1y');

  const [activeTab, setActiveTab] = useState<'monitor' | 'history' | 'calc' | 'vault' | 'marketplace'>(() => {
    return (localStorage.getItem('typhoon_vault_activeTab') as any) || 'monitor';
  });
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>(() => {
    return (localStorage.getItem('typhoon_vault_network') as any) || 'testnet';
  });
  const [isWalletConnected, setIsWalletConnected] = useState(() => {
    return localStorage.getItem('typhoon_vault_isWalletConnected') === 'true';
  });
  const [hasAgreedToLegal, setHasAgreedToLegal] = useState(() => {
    const initialNetwork = localStorage.getItem('typhoon_vault_network') || 'testnet';
    const initialAddress = localStorage.getItem('typhoon_vault_walletAddress') || '';
    if (initialAddress) {
      return localStorage.getItem(`typhoon_vault_legal_consent_${initialNetwork}_${initialAddress}`) === 'true';
    }
    return false;
  });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState(() => {
    return localStorage.getItem('typhoon_vault_walletAddress') || '';
  });
  const [isVerified, setIsVerified] = useState(() => {
    const initialNetwork = localStorage.getItem('typhoon_vault_network') || 'testnet';
    const initialAddress = localStorage.getItem('typhoon_vault_walletAddress') || '';
    if (initialAddress) {
      const saved = localStorage.getItem(`typhoon_vault_${initialNetwork}_${initialAddress}`);
      if (saved) {
        try {
          return JSON.parse(saved).isVerified === true;
        } catch (e) {}
      }
    }
    return false;
  });
  const [farms, setFarms] = useState<Farm[]>(() => {
    const initialNetwork = localStorage.getItem('typhoon_vault_network') || 'testnet';
    const initialAddress = localStorage.getItem('typhoon_vault_walletAddress') || '';
    if (initialAddress) {
      const saved = localStorage.getItem(`typhoon_vault_${initialNetwork}_${initialAddress}`);
      if (saved) {
        try {
          return JSON.parse(saved).farms || [];
        } catch (e) {}
      }
    }
    return [];
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ id: string, text: string, type: 'info' | 'success' | 'warning', timestamp: number }[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<{ id: string, text: string, type: 'info' | 'success' | 'warning', timestamp: number }[]>(() => {
    const initialNetwork = localStorage.getItem('typhoon_vault_network') || 'testnet';
    const initialAddress = localStorage.getItem('typhoon_vault_walletAddress') || '';
    if (initialAddress) {
      const saved = localStorage.getItem(`typhoon_vault_notifs_${initialNetwork}_${initialAddress}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return [];
  });

  // 🚪 Signout Confirmation State
  const [isSignoutConfirmOpen, setIsSignoutConfirmOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [walletError, setWalletError] = useState<{ id: string, message: string, url?: string } | null>(null);

  // ─── Offline-First Intent Recovery ──────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      const pendingClaims = JSON.parse(localStorage.getItem('vault_pending_claims') || '[]');
      const pendingActions = JSON.parse(localStorage.getItem('vault_pending_actions') || '[]');
      
      if (pendingClaims.length > 0 || pendingActions.length > 0) {
        addNotification('Connection restored! You have pending items to finalize.', 'success');
        // We don't automatically process as they require wallet signatures
        // but we ensure the UI is ready to prompt the user
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 👤 Profile Dashboard State
  const [isProfileDashboardOpen, setIsProfileDashboardOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // ➕ Add Farm & 👤 Edit Profile Modals States
  const [isAddFarmModalOpen, setIsAddFarmModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const [profileForm, setProfileForm] = useState({
    farmerName: '',
    rsbsaNumber: '',
    region: 'Central Luzon',
    phoneNumber: '',
    uploadedRsbsa: '',
    uploadedValidId: ''
  });

  const [newFarmForm, setNewFarmForm] = useState({
    farmName: '',
    cropType: 'Rice',
    plantingDate: new Date().toISOString().split('T')[0],
    farmSize: 1.5,
    initialInvestment: 250,
    expectedHarvestValue: 1000,
    latitude: 13.421,
    longitude: 123.413
  });

  const [modalLandDocType, setModalLandDocType] = useState<'deed_of_sale' | 'land_title'>('land_title');
  const [modalIsUploadingLandDoc, setModalIsUploadingLandDoc] = useState(false);
  const [modalUploadedLandDoc, setModalUploadedLandDoc] = useState<string | null>(null);
  const [modalIsValuing, setModalIsValuing] = useState(false);
  const [modalValuationExplanation, setModalValuationExplanation] = useState<string>('');
  const [modalValuationConfidence, setModalValuationConfidence] = useState<number>(100);

  const regionCoordinates: Record<string, { lat: number, lng: number }> = PHILIPPINE_REGIONS.reduce((acc, r) => {
    acc[r.name] = { lat: r.coordinates[0], lng: r.coordinates[1] };
    return acc;
  }, {} as Record<string, { lat: number, lng: number }>);

  useEffect(() => {
    if (!isAddFarmModalOpen || !newFarmForm.farmSize || newFarmForm.farmSize <= 0) return;

    let active = true;
    const fetchValuation = async () => {
      setModalIsValuing(true);
      try {
        const result = await estimateCropMetrics(
          newFarmForm.cropType,
          newFarmForm.farmSize,
          profileForm.region || 'Central Luzon'
        );
        if (active) {
          setNewFarmForm(prev => ({
            ...prev,
            initialInvestment: result.initialInvestment,
            expectedHarvestValue: result.expectedHarvestValue
          }));
          setModalValuationExplanation(result.explanation);
          setModalValuationConfidence(result.confidenceScore);
        }
      } catch (err) {
        console.error('Error auto-valuing crop in modal:', err);
      } finally {
        if (active) {
          setModalIsValuing(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchValuation();
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [newFarmForm.cropType, newFarmForm.farmSize, profileForm.region, isAddFarmModalOpen]);


  // 🧪 Testnet Developer Sandbox States
  const [isSimulatingWeather, setIsSimulatingWeather] = useState(false);

  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      requestNotificationPermission().then(token => {
        if (token) {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
          fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: walletAddress, fcmToken: token })
          }).catch(err => console.error("Failed to register FCM token:", err));
        }
      });
    }
  }, [isWalletConnected, walletAddress]);

  const [fundingAmount, setFundingAmount] = useState(100);
  const [contractTvl, setContractTvl] = useState<number>(0);
  const [contractSubsidy, setContractSubsidy] = useState<number>(0);
  const [userLpBalance, setUserLpBalance] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      
      try {
        const tvl = await getContractTvl(network);
        const subsidy = await getContractSubsidy(network);
        setContractTvl(tvl);
        setContractSubsidy(subsidy);

        if (walletAddress) {
          const lpBal = await getUserLpBalance(walletAddress, network);
          setUserLpBalance(lpBal);
        }
      } catch (e) {
        console.error("Failed to fetch contract stats", e);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [network, walletAddress]);

  const [testnetTvl, setTestnetTvl] = useState(1500000);
  const [subsidyBalance, setSubsidyBalance] = useState(750000);
  
  const isMainnet = network === 'mainnet';
  const isTestnet = network === 'testnet';

  const currentTvl = contractTvl;
  const currentSubsidy = contractSubsidy;

  // Open Policy modal state
  const [openPolicy, setOpenPolicy] = useState<'tos' | 'privacy' | 'cookie' | 'agreement' | null>(null);

  const [claims, setClaims] = useState<Claim[]>(() => {
    const initialNetwork = localStorage.getItem('typhoon_vault_network') || 'testnet';
    const initialAddress = localStorage.getItem('typhoon_vault_walletAddress') || '';
    if (initialAddress) {
      const saved = localStorage.getItem(`typhoon_vault_${initialNetwork}_${initialAddress}`);
      if (saved) {
        try {
          return JSON.parse(saved).claims || (initialNetwork === 'mainnet' || initialNetwork === 'testnet' ? [] : [
            { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
          ]);
        } catch (e) {}
      }
    }
    return initialNetwork === 'mainnet' || initialNetwork === 'testnet' ? [] : [
      { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
    ];
  });

  // Persist basic options
  useEffect(() => {
    localStorage.setItem('typhoon_vault_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('typhoon_vault_network', network);
  }, [network]);

  // Persist sandbox values
  useEffect(() => {
    localStorage.setItem('typhoon_vault_testnetTvl', String(testnetTvl));
    localStorage.setItem('typhoon_vault_subsidyBalance', String(subsidyBalance));
  }, [testnetTvl, subsidyBalance]);

  // Persist connection details globally
  useEffect(() => {
    localStorage.setItem('typhoon_vault_isWalletConnected', String(isWalletConnected));
    localStorage.setItem('typhoon_vault_walletAddress', walletAddress);
  }, [isWalletConnected, walletAddress]);

  useEffect(() => {
    if (isSimulatingWeather) return; // Skip fetching if sandbox weather simulator is active
    
    const loadWeather = async () => {
      setIsLoading(true);
      try {
        const lat = farms.length > 0 ? farms[0].latitude : 14.5995;
        const lon = farms.length > 0 ? farms[0].longitude : 120.9842;
        const data = await fetchWeather(lat, lon);
        setWeather(data);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadWeather();

    const interval = setInterval(loadWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [farms, isSimulatingWeather]);

  const handleSimulateWeather = (scenario: 'normal' | 'wind_trigger' | 'rain_trigger' | 'double_trigger') => {
    setIsSimulatingWeather(true);
    let simulated: WeatherData;
    
    // Reset hasClaimed to false for all farms to allow clean testing of a new simulated storm
    setFarms(prev => prev.map(f => ({ ...f, hasClaimed: false })));

    if (scenario === 'normal') {
      simulated = {
        temperature: 28.5,
        windSpeed: 45.0,
        windGusts: 18.2,
        rainfall: 25.0,
        rain: 4.8,
        condition: 'Clear',
        weatherCode: 0,
        humidity: 65,
        pressure: 1012,
        timestamp: new Date().toLocaleTimeString(),
        updatedAt: new Date(),
        damageEstimation: 0,
        cropHealthIndex: 0.98,
        agromonitorStatus: 'Excellent - Optimum Growth',
        activeStorm: null,
        hourlyTime: Array.from({ length: 24 }, (_, i) => new Date(Date.now() - i * 3600000)),
        hourlyWindSpeed: Array.from({ length: 24 }, () => 10 + Math.random() * 5),
        hourlyPrecipitation: Array.from({ length: 24 }, () => Math.random() * 2),
      };
      addNotification('Simulating normal weather conditions on Testnet.', 'info');
    } else if (scenario === 'wind_trigger') {
      simulated = {
        temperature: 24.0,
        windSpeed: 115.0,
        windGusts: 145.0,
        rainfall: 80.0,
        rain: 78.0,
        condition: 'Stormy',
        weatherCode: 95, // Thunderstorm
        humidity: 98,
        pressure: 985,
        timestamp: new Date().toLocaleTimeString(),
        updatedAt: new Date(),
        damageEstimation: 30,
        aiDamageEstimation: 25,
        cropHealthIndex: 0.70,
        agromonitorStatus: 'CRITICAL - Moderate Typhoon Winds',
        activeStorm: {
          name: 'TYPHOON SIMULATOR',
          lat: (farms[0]?.latitude || 14.5995) - 0.8,
          lon: (farms[0]?.longitude || 120.9842) + 1.8,
          severity: 'Moderate'
        },
        hourlyTime: Array.from({ length: 24 }, (_, i) => new Date(Date.now() - i * 3600000)),
        hourlyWindSpeed: Array.from({ length: 24 }, (_, i) => i < 12 ? 30 + i * 8 : 115 - (i - 12) * 5),
        hourlyPrecipitation: Array.from({ length: 24 }, () => 5 + Math.random() * 10),
      };
      addNotification('💨 Moderate Typhoon trigger (30% payout) simulated! Contract parametric claim enabled.', 'warning');
    } else if (scenario === 'rain_trigger') {
      simulated = {
        temperature: 25.5,
        windSpeed: 135.0,
        windGusts: 165.0,
        rainfall: 220.0,
        rain: 215.0,
        condition: 'Rainy',
        weatherCode: 65, // Heavy rain
        humidity: 99,
        pressure: 995,
        timestamp: new Date().toLocaleTimeString(),
        updatedAt: new Date(),
        damageEstimation: 70,
        aiDamageEstimation: 82,
        cropHealthIndex: 0.35,
        agromonitorStatus: 'CRITICAL - Severe Typhoon Flooding',
        activeStorm: {
          name: 'MONSOON SIMULATOR',
          lat: (farms[0]?.latitude || 14.5995) - 0.9,
          lon: (farms[0]?.longitude || 120.9842) + 1.9,
          severity: 'Severe'
        },
        hourlyTime: Array.from({ length: 24 }, (_, i) => new Date(Date.now() - i * 3600000)),
        hourlyWindSpeed: Array.from({ length: 24 }, () => 20 + Math.random() * 10),
        hourlyPrecipitation: Array.from({ length: 24 }, (_, i) => i < 12 ? 10 + i * 3 : 30 - (i - 12) * 2),
      };
      addNotification('🌧️ Severe Typhoon trigger (70% payout) simulated! Contract parametric claim enabled.', 'warning');
    } else { // double_trigger
      simulated = {
        temperature: 23.0,
        windSpeed: 165.0,
        windGusts: 220.0,
        rainfall: 350.0,
        rain: 335.0,
        condition: 'Stormy',
        weatherCode: 99, // Heavy thunderstorm
        humidity: 100,
        pressure: 965,
        timestamp: new Date().toLocaleTimeString(),
        updatedAt: new Date(),
        damageEstimation: 90,
        aiDamageEstimation: 90,
        cropHealthIndex: 0.05,
        agromonitorStatus: 'CATASTROPHIC - Super Typhoon Active',
        activeStorm: {
          name: 'SUPER TYPHOON SIMULATOR',
          lat: (farms[0]?.latitude || 14.5995) - 1.0,
          lon: (farms[0]?.longitude || 120.9842) + 2.0,
          severity: 'Extreme'
        },
        hourlyTime: Array.from({ length: 24 }, (_, i) => new Date(Date.now() - i * 3600000)),
        hourlyWindSpeed: Array.from({ length: 24 }, (_, i) => i < 12 ? 50 + i * 11 : 165 - (i - 12) * 8),
        hourlyPrecipitation: Array.from({ length: 24 }, (_, i) => i < 12 ? 15 + i * 4 : 40 - (i - 12) * 3),
      };
      addNotification('🌀 SUPER TYPHOON double trigger met! 90% full parametric claim enabled on Testnet.', 'warning');
    }

    setWeather(simulated);
  };

  const handleResetWeather = async () => {
    setIsSimulatingWeather(false);
    addNotification('Reconnecting to Open-Meteo and fetching live weather feeds...', 'info');
    setIsLoading(true);
    try {
      const lat = farms.length > 0 ? farms[0].latitude : 14.5995;
      const lon = farms.length > 0 ? farms[0].longitude : 120.9842;
      const data = await fetchWeather(lat, lon);
      setWeather(data);
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContributeLiquidity = async (type: 'lp' | 'subsidy') => {
    if (fundingAmount <= 0) {
      addNotification('Please enter a valid amount greater than 0 XLM', 'warning');
      return;
    }

    if (!isWalletConnected || !walletAddress) {
      addNotification('Please connect your wallet first', 'warning');
      return;
    }

    const actionText = type === 'lp' 
      ? (stakingMode === 'withdraw' ? 'withdrawal' : 'liquidity contribution')
      : 'subsidy deposit';

    addNotification(`Initiating ${actionText} of ${fundingAmount.toLocaleString()} XLM on ${network}...`, 'info');
    
    try {
      const txHash = await contributeLiquidityOnChain(walletAddress, fundingAmount, type, stakingMode, network);
      
      if (type === 'lp') {
        if (stakingMode === 'withdraw') {
          addNotification(`Success! Withdrew ${fundingAmount.toLocaleString()} XLM from Reinsurance Pool. LP shares burned.`, 'success');
        } else {
          addNotification(`Success! Contributed ${fundingAmount.toLocaleString()} XLM to Reinsurance Pool. LP shares issued.`, 'success');
        }
      } else {
        addNotification(`Success! Deposited ${fundingAmount.toLocaleString()} XLM to Donor Subsidy Pool.`, 'success');
      }

      console.log(`[${network.toUpperCase()}] Transaction confirmed on ledger. Tx Hash: ${txHash}`);
    } catch (e: any) {
      addNotification(`Operation failed: ${e.message || 'Cancelled'}`, 'warning');
    }
  };

  const addNotification = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    const timestamp = Date.now();
    const newNotif = { id, text, type, timestamp };

    setNotifications(prev => [newNotif, ...prev]);
    setNotificationHistory(prev => {
      const updated = [newNotif, ...prev].slice(0, 50); // Keep last 50
      return updated;
    });

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Persist notifications
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      localStorage.setItem(`typhoon_vault_notifs_${network}_${walletAddress}`, JSON.stringify(notificationHistory));
    }
  }, [notificationHistory, isWalletConnected, walletAddress, network]);


  const handleConnectWallet = async (walletId: string) => {
    try {
      if (walletId.startsWith("DEMO_TESTNET")) {
        // Special case for demo mode bypass
        handleWalletConnected(walletId);
        return;
      }
      const address = await connectWallet(network, walletId);
      handleWalletConnected(address);
    } catch (error: any) {
      if (error.message && error.message.startsWith('WALLET_NOT_INSTALLED')) {
        const id = error.message.split(':')[1];
        let url = 'https://stellar.org/ecosystem/wallets';
        if (id === 'freighter') url = 'https://chromewebstore.google.com/detail/freighter/kaojnmgeecghoocplkaeoojagghgocho';
        if (id === 'xbull') url = 'https://xbull.app/';
        
        setWalletError({
          id,
          message: `The ${id.charAt(0).toUpperCase() + id.slice(1)} wallet is not installed or not active.`,
          url
        });
      } else {
        setWalletError({
          id: 'connection',
          message: error.message || 'Failed to connect wallet. Ensure the wallet extension is unlocked or your mobile app is active.'
        });
      }
    }
  };

  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    setIsWalletConnected(true);
    
    // Check both standalone key and the combined data object for consent
    let consent = localStorage.getItem(`typhoon_vault_legal_consent_${network}_${address}`) === 'true';

    const savedData = localStorage.getItem(`typhoon_vault_${network}_${address}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFarms(parsed.farms || []);
        setIsVerified(parsed.isVerified || false);
        if (parsed.hasAgreedToLegal !== undefined) {
          consent = parsed.hasAgreedToLegal;
        }
        if (parsed.claims) {
          setClaims(parsed.claims);
        }
        if (parsed.profileForm) {
          setProfileForm(parsed.profileForm);
        }
      } catch (e) {
        console.error("Failed to load account data", e);
      }
    }
    
    setHasAgreedToLegal(consent);
    addNotification(`Securely connected to Stellar ${isMainnet ? 'Mainnet' : 'Testnet'}`, 'success');
  };

  // Sync state when network, wallet address, or connection status changes
  useEffect(() => {
    // SECURITY PATCH: Clear weather state when switching networks to prevent testnet/demo simulation data from being carried over to mainnet
    setWeather(null);
    setIsSimulatingWeather(false);

    if (isWalletConnected && walletAddress) {
      let consent = localStorage.getItem(`typhoon_vault_legal_consent_${network}_${walletAddress}`) === 'true';

      const savedData = localStorage.getItem(`typhoon_vault_${network}_${walletAddress}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setFarms(parsed.farms || []);
          setIsVerified(parsed.isVerified || false);
          if (parsed.hasAgreedToLegal !== undefined) {
            consent = parsed.hasAgreedToLegal;
          }
          setClaims(parsed.claims || (network === 'mainnet' ? [] : [
            { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
          ]));
          if (parsed.profileForm) {
            setProfileForm(parsed.profileForm);
          }
        } catch (e) {
          console.error("Failed to load account data on sync change", e);
        }
      } else {
        setFarms([]);
        setIsVerified(false);
        setClaims(network === 'mainnet' ? [] : [
          { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
        ]);
      }
      setHasAgreedToLegal(consent);
    } else {
      setFarms([]);
      setIsVerified(false);
      setHasAgreedToLegal(false);
      setClaims(network === 'mainnet' ? [] : [
        { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
      ]);
    }
  }, [walletAddress, network, isWalletConnected]);

  // Save account-specific data whenever it changes and matches a genuine user mutation
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      const savedData = localStorage.getItem(`typhoon_vault_${network}_${walletAddress}`);
      let shouldSave = true;
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (JSON.stringify(parsed.farms) === JSON.stringify(farms) &&
              parsed.isVerified === isVerified &&
              parsed.hasAgreedToLegal === hasAgreedToLegal &&
              JSON.stringify(parsed.claims) === JSON.stringify(claims) &&
              JSON.stringify(parsed.profileForm) === JSON.stringify(profileForm)) {
            shouldSave = false;
          }
        } catch (e) {}
      }
      if (shouldSave) {
        const data = { farms, isVerified, claims, profileForm, hasAgreedToLegal };
        localStorage.setItem(`typhoon_vault_${network}_${walletAddress}`, JSON.stringify(data));
      }
    }
  }, [farms, isVerified, claims, network, walletAddress, profileForm, hasAgreedToLegal]);

  // Sync profile form inputs with the first farm's details (if they exist)
  useEffect(() => {
    if (farms.length > 0) {
      const f = farms[0];
      setProfileForm({
        farmerName: f.farmerName || '',
        rsbsaNumber: f.rsbsaNumber || '',
        region: f.region || 'Central Luzon',
        phoneNumber: f.phoneNumber || '',
        uploadedRsbsa: 'verified-rsbsa.pdf',
        uploadedValidId: 'verified-valid-id.png'
      });
    } else {
      setProfileForm(prev => ({
        ...prev,
        uploadedRsbsa: '',
        uploadedValidId: ''
      }));
    }
  }, [farms]);

  const handleEditProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.farmerName || !profileForm.rsbsaNumber) {
      addNotification('Please enter both name and RSBSA number', 'warning');
      return;
    }
    
    // Update all existing farms with the new profile info
    setFarms(prev => prev.map(farm => ({
      ...farm,
      farmerName: profileForm.farmerName,
      rsbsaNumber: profileForm.rsbsaNumber,
      region: profileForm.region,
      phoneNumber: profileForm.phoneNumber
    })));
    
    setIsEditProfileModalOpen(false);
    addNotification('Farmer Profile updated successfully!', 'success');
  };

  const handleAddFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmForm.farmName) {
      addNotification('Please enter a farm name', 'warning');
      return;
    }
    if (!modalUploadedLandDoc) {
      addNotification('Please upload a land ownership proof document', 'warning');
      return;
    }
    
    // Copy farmer profile info
    const totalCropValue = Number(newFarmForm.expectedHarvestValue) * 1.15;
    const newFarm: Farm = {
      id: `FARM-${Math.floor(Math.random() * 10000)}`,
      farmerName: profileForm.farmerName || 'Juan Dela Cruz (Demo)',
      rsbsaNumber: profileForm.rsbsaNumber || '24-123-45678',
      region: profileForm.region || 'Central Luzon',
      phoneNumber: profileForm.phoneNumber || '+63 912 345 6789',
      farmName: newFarmForm.farmName,
      cropType: newFarmForm.cropType,
      plantingDate: newFarmForm.plantingDate,
      farmSize: Number(newFarmForm.farmSize),
      initialInvestment: Number(newFarmForm.initialInvestment),
      expectedHarvestValue: Number(newFarmForm.expectedHarvestValue),
      latitude: Number(newFarmForm.latitude),
      longitude: Number(newFarmForm.longitude),
      totalCropValue, // Standard buffer
      isInsured: true,
      landDocument: {
        fileName: modalUploadedLandDoc,
        docType: modalLandDocType,
        uploadedAt: new Date().toISOString()
      }
    };
    
    // Register on Stellar blockchain asynchronously (or show loading)
    addNotification('Initiating Stellar Soroban smart contract registration...', 'info');
    try {
      await registerPolicyOnChain(
        walletAddress,
        newFarm.farmName.replace(/\s+/g, '_'),
        profileForm.region,
        newFarm.totalCropValue,
        'Wet Season 2026',
        network
      );
      addNotification('Stellar ledger transaction confirmed!', 'success');
    } catch (err: any) {
      console.error('Error registering policy on chain:', err);
      addNotification(`Blockchain registration warning: ${err.message || 'connection timeout'}. Local policy saved.`, 'warning');
    }

    setFarms(prev => [...prev, newFarm]);
    setIsAddFarmModalOpen(false);
    
    // Reset form and modal states
    setNewFarmForm({
      farmName: '',
      cropType: 'Rice',
      plantingDate: new Date().toISOString().split('T')[0],
      farmSize: 1.5,
      initialInvestment: 250,
      expectedHarvestValue: 1000,
      latitude: 13.421,
      longitude: 123.413
    });
    setModalUploadedLandDoc(null);
    setModalLandDocType('land_title');
    
    addNotification(`Successfully registered and insured '${newFarm.farmName}' on-chain!`, 'success');
  };

  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleDisconnect = () => {
    setWalletAddress('');
    setIsWalletConnected(false);
    setIsVerified(false);
    setHasAgreedToLegal(false);
    setFarms([]);
    setClaims(network === 'mainnet' ? [] : [
      { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
    ]);
    addNotification(`Securely disconnected from TyFi (${network.toUpperCase()}).`, 'warning');
  };

  const handleVerificationComplete = (newFarmsData: FarmData[]) => {
    if (newFarmsData.length > 0) {
      const firstFarm = newFarmsData[0];
      setProfileForm({
        farmerName: firstFarm.farmerName || '',
        rsbsaNumber: firstFarm.rsbsaNumber || '',
        region: firstFarm.region || 'Central Luzon',
        phoneNumber: firstFarm.phoneNumber || '',
        uploadedRsbsa: 'verified',
        uploadedValidId: 'verified'
      });
    }

    const newFarms: Farm[] = newFarmsData.map(farmData => ({
      ...farmData,
      id: farmData.id || `FARM-${Math.floor(Math.random() * 10000)}`,
      isInsured: true
    }));
    setFarms(newFarms);
    setIsVerified(true);
    addNotification(`${newFarms.length} farm(s) verified and secured on Stellar ${isMainnet ? 'Mainnet' : 'Testnet'}`, 'success');
  };

  const handleClaim = (farm: FarmData) => {
    if (farm.hasClaimed) return;
    
    if (!weather) {
      addNotification('No active weather data to process a claim.', 'warning');
      return;
    }

    let payoutRatio = 0;
    let triggerDesc = `Parametric conditions not met`;

    const oracleDamage = weather.damageEstimation || 0;
    const aiDamage = weather.aiDamageEstimation;
    const combinedDamage = calculateCombinedDamage(oracleDamage, aiDamage);
    
    const ws = weather.windSpeed;
    const rf = weather.rainfall;
    
    if (ws >= 150 || rf >= 300) {
      triggerDesc = `Super Typhoon (Oracle: ${oracleDamage}%, AI: ${aiDamage}%) - Combined: ${combinedDamage}% Payout`;
      payoutRatio = isMainnet ? 0.9 : combinedDamage / 100;
    } else if (ws >= 120 || rf >= 200) {
      triggerDesc = `Severe Typhoon (Oracle: ${oracleDamage}%, AI: ${aiDamage}%) - Combined: ${combinedDamage}% Payout`;
      payoutRatio = isMainnet ? 0.8 : combinedDamage / 100;
    } else if (ws >= 100 || rf >= 100) {
      triggerDesc = `Typhoon Trigger (Oracle: ${oracleDamage}%, AI: ${aiDamage}%) - Combined: ${combinedDamage}% Payout`;
      payoutRatio = isMainnet ? 0.5 : combinedDamage / 100;
    } else {
      triggerDesc = `Parametric limits not met (Combined: ${combinedDamage}%)`;
      // Mainnet strictly denies payout if wind/rain limits not met
      payoutRatio = isMainnet ? 0 : combinedDamage / 100;
    }

    // Security check for zero payout
    if (payoutRatio <= 0) {
      addNotification('Parametric payout calculated as 0 XLM for current weather metrics.', 'warning');
      return;
    }

    const claimAmount = Math.round((farm.totalCropValue || 1000) * payoutRatio);
    if (claimAmount <= 0) {
      addNotification('Parametric payout calculated as 0 XLM for current weather metrics.', 'warning');
      return;
    }

    // Set farm as claimed and lock the payout amount and ratio
    setFarms(prev => prev.map(f => f.id === farm.id ? { 
      ...f, 
      hasClaimed: true, 
      claimedAmount: claimAmount, 
      claimedRatio: payoutRatio 
    } : f));

    // Handle blockchain claim if wallet connected
    if (isWalletConnected) {
      const pubkey = localStorage.getItem('stellar_pubkey') || '';
      const typhoonId = weather?.activeStorm?.name || 'TROPICAL_DEPRESSION_CONSENSUS';
      const region = farm.region || 'Central Luzon';
      
      const processClaim = async () => {
        try {
          await claimPayoutOnChain(pubkey, farm.id, farm.season || 'Wet Season 2026', isMainnet ? 'mainnet' : 'testnet', typhoonId);
        } catch (err) {
          console.error("Stellar claim error:", err);
          addNotification('Transaction failed or rejected by wallet.', 'warning');
        }
      };
      processClaim();
    }

    const newClaim: Claim = {
      id: `TX-${Math.floor(Math.random() * 10000)}`,
      date: new Date().toISOString().split('T')[0],
      amount: claimAmount,
      status: 'Paid',
      trigger: triggerDesc
    };

    setClaims(prev => [newClaim, ...prev]);
    
    if (!isMainnet) {
      setTestnetTvl(prev => Math.max(0, prev - claimAmount));
    }
    
    addNotification(`Insurance payout of ${claimAmount.toLocaleString()} XLM (${Math.round(payoutRatio * 100)}%) processed on Stellar ${isMainnet ? 'Mainnet' : 'Testnet Sandbox'}!`, 'success');
  };

  if (!isWalletConnected) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Glow effects in background */}
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full filter blur-[120px] transition-all duration-1000 -z-10 ${
          isMainnet ? 'bg-emerald-500/10' : 'bg-sky-500/10'
        }`} />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full filter blur-[100px] transition-all duration-1000 -z-10 bg-indigo-500/5" />

        {/* Network Selector Pill on Landing */}
        <div className="mb-8 z-10 flex items-center bg-white/5 p-1.5 rounded-full border border-white/5 shadow-2xl backdrop-blur-md">
          <button
            onClick={() => {
              setNetwork('testnet');
              addNotification('Configured for Stellar Testnet Sandbox', 'info');
            }}
            className={`text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-full transition-all duration-500 ${
              !isMainnet
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 scale-105'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Stellar Testnet
          </button>
          <button
            onClick={() => {
              setNetwork('mainnet');
              addNotification('Configured for Stellar Mainnet (Real Assets)', 'success');
            }}
            className={`text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-full transition-all duration-500 ${
              isMainnet
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Stellar Mainnet
          </button>
        </div>

        <div className="max-w-md w-full glass-panel text-center space-y-8 py-12 relative z-10 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center transition-all duration-700 shadow-2xl ${
            isMainnet 
              ? 'bg-emerald-500 shadow-emerald-500/30' 
              : 'bg-sky-500 shadow-sky-500/30'
          } animate-pulse`}>
            <img src="/logo.svg" alt="TyFi Logo" className="w-14 h-14" />
          </div>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border inline-block mb-3 ${
              isMainnet 
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                : 'text-sky-400 border-sky-500/20 bg-sky-500/5'
            }`}>
              {isMainnet ? '💎 Production Environment Active' : '🧪 Developer Sandbox Active'}
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
              Ty<span className={isMainnet ? 'text-emerald-500 transition-colors duration-700' : 'text-sky-500 transition-colors duration-700'}>Fi</span>
            </h1>
            <p className="text-slate-400 mt-4 text-sm font-medium">Parametric Agricultural Insurance Protocol</p>
          </div>
          
          <button
            onClick={() => setIsWalletModalOpen(true)}
            className={`w-full text-white font-black py-4 rounded-2xl transition-all duration-500 flex items-center justify-center gap-3 group ${
              isMainnet 
                ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                : 'bg-sky-500 hover:bg-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.2)]'
            }`}
          >
            <Wallet size={20} className="group-hover:rotate-12 transition-transform" />
            Connect Web3 Wallet
          </button>
        </div>

        <WalletModal 
          isOpen={isWalletModalOpen} 
          onClose={() => setIsWalletModalOpen(false)}
          onConnect={handleConnectWallet}
          network={network}
        />

        {/* Wallet Error Popup */}
        {walletError && (
          <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                  <AlertCircle size={24} />
                </div>
                <button onClick={() => setWalletError(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-black text-white mb-2">Connection Error</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                {walletError.message}
              </p>
              
              <div className="space-y-3">
                {walletError.url && (
                  <a 
                    href={walletError.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    Install {walletError.id.charAt(0).toUpperCase() + walletError.id.slice(1)} <ArrowUpRight size={16} />
                  </a>
                )}
                <button 
                  onClick={() => setWalletError(null)}
                  className="w-full py-3 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!hasAgreedToLegal) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="p-8 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-4 mb-2">
              <div className={`p-2.5 rounded-xl ${isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Protocol Onboarding</h2>
            </div>
            <p className="text-slate-400 text-sm font-medium">Please review and accept our legal policies to proceed with TyFi.</p>
          </div>

          <div className="p-8 overflow-y-auto space-y-10 text-[13px] text-slate-300 leading-relaxed custom-scrollbar">
            {/* 1. COMPREHENSIVE TERMS OF SERVICE */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-sky-500 pl-4 bg-sky-500/5 py-1">1. Master Terms of Service & Platform Governance</h3>
              <p className="font-bold text-slate-200">PLEASE READ THESE TERMS CAREFULLY. BY ACCESSING THE TYFI INTERFACE AND CONNECTING A DISTRIBUTED LEDGER TECHNOLOGY (DLT) WALLET, YOU UNCONDITIONALLY ACCEPT AND AGREE TO BE BOUND BY THESE MASTER TERMS.</p>
              
              <div className="pl-4 space-y-4 border-l border-white/10">
                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">1.1 Distributed Ledger Environment (Mainnet vs. Testnet)</h4>
                  <p className="text-xs text-slate-400">The Platform operates across two distinct cryptographic environments. The "Testnet Sandbox" is a simulated environment utilizing non-value assets (Test-XLM) for educational and protocol-testing purposes; actions herein do not constitute financial obligations. Conversely, the "Mainnet" is the production Stellar Public Ledger. Transactions executed on Mainnet involve Real-World Assets (RWA) and constitute legally binding, immutable entries on a global decentralized database.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">1.2 Decentralized Autonomous Underwriting</h4>
                  <p className="text-xs text-slate-400">You acknowledge that TyFi is a non-custodial decentralized application (dApp). Underwriting logic, premium distribution, and payout mechanisms are governed exclusively by Soroban Smart Contracts (the "Code"). There is no central administrative authority, board of directors, or manual overrides. The "Code is Law"; the protocol operates exactly as programmed, regardless of external circumstances or perceived inequities.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">1.3 Limitation of Liability & Disclaimer of Warranties</h4>
                  <p className="text-xs text-slate-400">THE PLATFORM IS PROVIDED ON AN "AS-IS" AND "AS-AVAILABLE" BASIS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, TYFI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED. WE SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM SMART CONTRACT VULNERABILITIES, NETWORK CONGESTION, WALLET INCOMPATIBILITY, OR LOSS OF PRIVATE KEYS. YOU ASSUME ALL RISKS ASSOCIATED WITH CRYPTOGRAPHIC TRANSACTIONS.</p>
                </div>
              </div>
            </section>

            {/* 2. PARAMETRIC INSURANCE AGREEMENT */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-emerald-500 pl-4 bg-emerald-500/5 py-1">2. Parametric Risk-Pooling & Disbursal Agreement</h3>
              <p className="italic text-slate-400">This section governs the specific parametric triggers, premium structures, and the automated settlement process between the Enrolled Farmer and the Underwriting Vault.</p>
              
              <div className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-6">
                <div className="space-y-3">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    2.1 The "Immutable Oracle" Consensus
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Settlement is determined via a multi-source "Oracle Consensus" model. This protocol aggregates geospatial and meteorological data from Open-Meteo, GDACS, and NASA-affiliated microwave precipitation radiometry. By enrolling, you irrevocably waive the right to contest these measurements. No manual damage assessment, adjuster field visit, or local testimony shall be admissible in modifying the contract's autonomous output.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
                    <span className="font-black text-white text-[10px] uppercase tracking-tighter text-sky-400">Trigger Alpha: Wind Velocity</span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Requires sustained 3-second gusts &ge; 150 km/h (Mainnet) or sliding scale &ge; 100 km/h (Testnet). Measured at the centroid of the registered farm polygon.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
                    <span className="font-black text-white text-[10px] uppercase tracking-tighter text-emerald-400">Trigger Beta: Precipitation</span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Requires cumulative liquid rainfall &ge; 200 mm within a rolling 24-hour window. Validated by at least two (2) independent satellite-derived data points.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest flex items-center gap-2 text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    2.2 Premium Forfeiture & No-Refund Policy
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-400">
                    Once a premium deposit is transmitted to the Soroban contract, it is immediately allocated to the Reinsurance Vault. These funds are locked for the duration of the defined "Season." There are no cancellations, partial refunds, or withdrawals permitted once the policy has been active for more than 48 hours.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. PRIVACY, DATA MINIMIZATION & COOKIES */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-indigo-500 pl-4 bg-indigo-500/5 py-1">3. Privacy Architecture & Data Sovereignty Policy</h3>
              <p className="text-slate-400">TyFi is engineered for maximum user sovereignty. We do not maintain a "User Account" in the traditional sense; your Identity is your Public Key.</p>
              
              <div className="pl-4 space-y-4 border-l border-white/10">
                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">3.1 Immutable Geospatial Publication</h4>
                  <p className="text-xs text-slate-400">To enable parametric monitoring, your farm's coordinate bounds must be published to the Stellar Ledger. This data is **public, permanent, and immutable**. By registering, you understand that your farm location is viewable by any entity with access to a Stellar explorer.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">3.2 Local-Only Identity Storage</h4>
                  <p className="text-xs text-slate-400">Sensitive credentials (RSBSA numbers, phone numbers, and land document filenames) are stored exclusively in your browser's "LocalStorage." Our backend servers never receive, store, or process this data. If you clear your browser cache or change devices without a backup, this information will be permanently lost.</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-black text-white uppercase text-[11px] tracking-widest">3.3 Zero-Cookie Tracking Protocol</h4>
                  <p className="text-xs text-slate-400">The Platform does not utilize HTTP Cookies, tracking pixels, or third-party behavioral analytics. Your interaction with this interface is strictly private between your browser and the decentralized RPC nodes of the Stellar Network.</p>
                </div>
              </div>
            </section>

            {/* 4. GOVERNING LAW & DISPUTE RESOLUTION */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-rose-500 pl-4 bg-rose-500/5 py-1">4. Governing Law & Jurisdictional Disclosures</h3>
              <div className="pl-4 space-y-4 border-l border-white/10">
                <p className="text-xs text-slate-400 leading-relaxed">
                  These Terms and any non-contractual obligations arising out of or in connection with them shall be governed by and construed in accordance with the laws of the **Republic of the Philippines** for agricultural matters, and the **Laws of Singapore** for matters pertaining to cryptographic assets and decentralized protocols. Any dispute, controversy, or claim arising out of or relating to this agreement shall be referred to and finally resolved by arbitration administered by the Singapore International Arbitration Centre (SIAC).
                </p>
              </div>
            </section>

            {/* 5. PROHIBITED JURISDICTIONS & SANCTIONS */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-amber-500 pl-4 bg-amber-500/5 py-1">5. Prohibited Jurisdictions & Global Sanctions Compliance</h3>
              <div className="pl-4 space-y-4 border-l border-white/10 text-xs text-slate-400">
                <p>By accepting these terms, you represent and warrant that you are not a citizen, resident, or organized under the laws of any jurisdiction that is subject to comprehensive sanctions by the United Nations, the United States Office of Foreign Assets Control (OFAC), or the European Union. Furthermore, you represent that you are not on the Specially Designated Nationals (SDN) list or any equivalent restricted party list.</p>
              </div>
            </section>

            {/* 6. INTELLECTUAL PROPERTY */}
            <section className="space-y-5">
              <h3 className="text-white font-black uppercase tracking-widest text-xs border-l-4 border-teal-500 pl-4 bg-teal-500/5 py-1">6. Intellectual Property & Interface Licensing</h3>
              <div className="pl-4 space-y-4 border-l border-white/10 text-xs text-slate-400">
                <p>The TyFi Interface is a front-end portal to the underlying decentralized smart contracts. While the smart contracts are deployed under open-source licenses (MIT/Apache 2.0), the visual design, branding, and proprietary "TyFi" trademark remain the exclusive property of the Protocol Founders. You are granted a limited, revocable, non-exclusive license to use the interface purely for the purpose of interacting with the Soroban protocol.</p>
              </div>
            </section>
            
            <div className="p-5 rounded-3xl bg-sky-500/5 border border-sky-500/10 flex items-start gap-4">
              <Info size={22} className="text-sky-400 mt-1 shrink-0" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <span className="text-white font-black uppercase tracking-tighter">Attestation:</span> By clicking the confirmation button below, you represent that you have the legal capacity to enter into this agreement, that you understand the high-risk nature of decentralized finance, and that you have independently verified the parametric trigger conditions as defined in the Soroban smart contract source code.
              </p>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-white/5">
            <button
              onClick={() => {
                localStorage.setItem(`typhoon_vault_legal_consent_${network}_${walletAddress}`, 'true');
                setHasAgreedToLegal(true);
                addNotification('Legal policies accepted. Welcome to TyFi!', 'success');
              }}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all transform hover:scale-[1.01] uppercase tracking-wider ${
                isMainnet 
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
              }`}
            >
              I Agree & Accept All Policies
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified && farms.length === 0) {
    return (
      <FarmerVerification 
        onVerificationComplete={handleVerificationComplete} 
        walletAddress={walletAddress} 
        network={network}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-sky-500/30">
      {/* Dynamic Ambient Background Light */}
      <div className={`absolute top-0 right-0 w-96 h-96 rounded-full filter blur-[120px] transition-colors duration-1000 -z-10 ${
        isMainnet ? 'bg-emerald-500/5' : isTestnet ? 'bg-sky-500/5' : 'bg-indigo-500/5'
      }`} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 -ml-2 text-slate-400 hover:text-white md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors duration-700 ${
              isMainnet ? 'bg-emerald-500 shadow-emerald-500/20' : isTestnet ? 'bg-sky-500 shadow-sky-500/20' : 'bg-indigo-500 shadow-indigo-500/20'
            }`}>
              <img src="/logo.svg" alt="TyFi Logo" className="w-7 h-7" />
            </div>
            <div className="hidden xs:block">
              <div className="text-sm font-black text-white tracking-tighter uppercase italic">TyFi</div>
              <div className={`text-[9px] font-bold uppercase tracking-widest transition-colors duration-700 ${
                isMainnet ? 'text-emerald-400' : isTestnet ? 'text-sky-400' : 'text-indigo-400'
              }`}>
                {isMainnet ? 'Mainnet' : 'Testnet'}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {(['monitor', 'calc', 'history', 'vault', 'marketplace'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === tab ? (isMainnet ? 'text-emerald-400' : isTestnet ? 'text-sky-400' : 'text-indigo-400') : 'text-slate-500 hover:text-white'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sleek Pill Network Toggle - Desktop only or compact on mobile */}
            <div className="hidden sm:flex items-center bg-white/5 p-1 rounded-full border border-white/5 gap-1 select-none">
              <button
                onClick={() => setNetwork('testnet')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all duration-300 ${
                  network === 'testnet' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                Testnet
              </button>
              <button
                onClick={() => setNetwork('mainnet')}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all duration-300 ${
                  network === 'mainnet' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mainnet
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
                className={`p-2 rounded-xl transition-all ${
                  isNotificationCenterOpen 
                    ? (isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400')
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bell size={20} />
                {notificationHistory.length > 0 && (
                  <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-slate-950 ${
                    notificationHistory[0]?.timestamp > Date.now() - 60000 ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'
                  }`} />
                )}
              </button>

              {/* Notification Center Popover */}
              {isNotificationCenterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationCenterOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-80 max-h-[480px] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Protocol Alerts</h4>
                      <button 
                        onClick={() => {
                          setNotificationHistory([]);
                          setIsNotificationCenterOpen(false);
                        }}
                        className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {notificationHistory.length === 0 ? (
                        <div className="p-8 text-center space-y-2">
                          <Bell size={32} className="mx-auto text-slate-800" />
                          <p className="text-xs text-slate-500 font-medium">No recent alerts or signals.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {notificationHistory.map((notif) => (
                            <div key={notif.id} className="p-4 hover:bg-white/5 transition-colors group">
                              <div className="flex gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  notif.type === 'success' ? 'bg-emerald-500' : 
                                  notif.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                                } shadow-[0_0_8px_rgba(var(--notif-color),0.5)]`}></div>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-200 font-medium leading-relaxed">{notif.text}</p>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white/5 text-center">
                      <button 
                        onClick={() => {
                          setIsProfileDashboardOpen(true);
                          setIsNotificationCenterOpen(false);
                        }}
                        className="text-[10px] text-sky-400 font-black uppercase tracking-widest hover:text-sky-300 transition-colors"
                      >
                        View Full History
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={`flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border transition-all cursor-pointer group hover:bg-white/10 ${
              isProfileDashboardOpen 
                ? (isMainnet ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-sky-500/30 ring-1 ring-sky-500/20')
                : 'border-white/5'
            }`} onClick={() => setIsProfileDashboardOpen(true)}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-700 ${
                isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
              }`}>
                <Wallet size={14} />
              </div>
              <span className="hidden xs:block text-[10px] font-mono text-slate-300">{formatAddress(walletAddress)}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300 md:hidden">
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
                <span className="text-xl font-black text-white italic tracking-tighter">TyFi</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X size={32} />
              </button>
            </div>
            
            <div className="flex flex-col gap-8">
              {(['monitor', 'calc', 'history', 'vault', 'marketplace'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
                  className={`text-2xl font-black uppercase tracking-tighter text-left transition-all ${
                    activeTab === tab ? (isMainnet ? 'text-emerald-400' : 'text-sky-400') : 'text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-12 border-t border-white/10 space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Network Environment</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setNetwork('testnet')} className={`py-3 rounded-xl text-xs font-black uppercase border ${network === 'testnet' ? 'bg-sky-500 border-sky-400 text-white' : 'border-white/10 text-slate-500'}`}>Testnet</button>
                  <button onClick={() => setNetwork('mainnet')} className={`py-3 rounded-xl text-xs font-black uppercase border ${network === 'mainnet' ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-white/10 text-slate-500'}`}>Mainnet</button>
                </div>
              </div>
              <button onClick={handleDisconnect} className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black uppercase tracking-widest text-sm">Disconnect Wallet</button>
            </div>
          </div>
        </div>
      )}

      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column - Main View */}
            <div className="lg:col-span-8 space-y-8">

              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-white tracking-tight">
                    {activeTab === 'monitor' ? t('header.protocolMonitoring') :
                      activeTab === 'calc' ? t('header.smartCalculator') :
                        activeTab === 'history' ? t('header.claimHistory') : t('header.vaultInfrastructure')}
                  </h1>
                  <p className="text-slate-400 mt-1">
                    {activeTab === 'monitor' ? `Automated smart contracts for ${farms[0]?.farmName || 'your farms'}` :
                      activeTab === 'calc' ? 'Analyze damage and estimate recovery payouts' :
                        activeTab === 'history' ? 'Transparency report of all triggered payouts' :
                          'Proof of liquidity and capital reserves'}
                  </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
                  <button
                    onClick={() => setActiveTab('monitor')}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20') : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'}`}
                  >
                    {t('nav.liveMonitor')}
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20') : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'}`}
                  >
                    {t('nav.claims')}
                  </button>
                  <button
                    onClick={() => setActiveTab('vault')}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'vault' ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20') : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'}`}
                  >
                    {t('nav.vault')}
                  </button>
                </div>
              </div>

              {/* Dynamic Content */}
              {activeTab === 'monitor' && (
                <>
                  <div className="glass-panel min-h-[400px] relative overflow-hidden">
                    <WeatherMap 
                      weather={weather} 
                      isLoading={isLoading} 
                      regionName={farms[0]?.region}
                      farmName={farms[0]?.farmName}
                      farms={farms}
                    />
                  </div>

                  <WeatherChart weather={weather} />

                  {weather && (
                    <div className="glass-panel">
                      <WeatherWidget
                        weather={weather}
                        isLoading={isLoading}
                        onRefresh={() => {
                          addNotification('Refreshing live weather feeds...', 'info');
                        }}
                      />
                    </div>
                  )}

                  <MarketWidget />
                </>
              )}
              {activeTab === 'calc' && (
                <div className="glass-panel">
                  <SmartCalculator farms={farms} weather={weather} />
                </div>
              )}

              {activeTab === 'history' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Left Column: Firebase History Dashboard */}
                  <div className="glass-panel">
                    <HistoryDashboard walletAddress={walletAddress} />
                  </div>

                  {/* Right Column: Live Ledger Stream */}
                  <LedgerStream network={network} />
                </div>
              )}

              {activeTab === 'vault' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* TVL */}
                    <div className={`glass-panel border transition-all duration-700 ${isMainnet ? 'border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : isTestnet ? 'border-sky-500/20 shadow-[0_0_20px_rgba(14,165,233,0.05)]' : 'border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.05)]'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : isTestnet ? 'bg-sky-500/10 text-sky-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                          <Lock size={20} />
                        </div>
                        <h3 className="font-black text-white text-sm">Total Value Locked</h3>
                      </div>
                      <div className="text-2xl font-black text-white mb-1">
                        {currentTvl.toLocaleString()} XLM
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold block -mt-1 mb-2">
                        ≈ {formatPhp(currentTvl)}
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <TrendingUp size={14} />
                        {isTestnet ? 'Testnet Real-time Data' : 'Mainnet Ledger Data'}
                      </div>
                    </div>

                    {/* Subsidy Pool */}
                    <div className={`glass-panel border transition-all duration-700 ${isMainnet ? 'border-emerald-500/20' : isTestnet ? 'border-sky-500/20' : 'border-indigo-500/20'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : isTestnet ? 'bg-sky-500/10 text-sky-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                          <Database size={20} />
                        </div>
                        <h3 className="font-black text-white text-sm">Subsidy Pool Balance</h3>
                      </div>
                      <div className="text-2xl font-black text-white mb-1">
                        {currentSubsidy.toLocaleString()} XLM
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold block -mt-1 mb-2">
                        ≈ {formatPhp(currentSubsidy)}
                      </div>
                      <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        Government & Donor Subsidy
                      </div>
                    </div>

                    {/* Reserve Ratio */}
                    <div className={`glass-panel border transition-all duration-700 ${isMainnet ? 'border-emerald-500/20' : isTestnet ? 'border-sky-500/20' : 'border-indigo-500/20'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : isTestnet ? 'bg-sky-500/10 text-sky-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                          <Wind size={20} />
                        </div>
                        <h3 className="font-black text-white text-sm">Reserve Ratio</h3>
                      </div>
                      <div className="text-2xl font-black text-white mb-2">
                        {currentTvl > 0 ? `${Math.round((currentTvl / 438000) * 100)}%` : '---%'}
                      </div>
                      <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        Over-collateralized protection
                      </div>
                    </div>
                  </div>

                  {/* Liquidity Providers */}
                  {isTestnet && (
                    <div className="glass-panel animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                      <h3 className="font-black text-white mb-6 uppercase tracking-wider text-sm">Liquidity Providers (Sandbox)</h3>
                      <div className="space-y-4">
                        {[
                          { name: 'Swiss Re Capital', share: '52%', amount: '1,248,000 XLM' },
                          { name: 'Luzon Agriculture Fund', share: '20%', amount: '480,000 XLM' },
                          { name: 'Asian Development Bank', share: '18%', amount: '432,000 XLM' },
                          { name: 'Protocol Reserves', share: '10%', amount: '240,000 XLM' },
                          ...(userLpBalance > 0 ? [{ name: 'Your Reinsurance Stake', share: `${((userLpBalance / currentTvl) * 100).toFixed(1)}%`, amount: `${userLpBalance.toLocaleString()} XLM` }] : [])
                        ].map((lp, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.01] rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${lp.name.startsWith('Your') ? 'bg-sky-500 animate-pulse' : 'bg-slate-700'}`} />
                              <div className="text-sm font-bold text-slate-300">{lp.name}</div>
                            </div>
                            <div className="flex gap-8">
                              <div className="text-right">
                                <div className="text-[10px] text-slate-500 uppercase font-black">Underwritten Amount</div>
                                <div className="text-xs font-bold text-white">{lp.amount}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-500 uppercase font-black">Share</div>
                                <div className="text-xs font-bold text-white">{lp.share}</div>
                              </div>
                              <div className="text-right w-20">
                                <div className="text-[10px] text-slate-500 uppercase font-black">Status</div>
                                <div className="text-xs font-bold text-emerald-400">Active</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userLpBalance > 0 && (
                     <div className="glass-panel animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                        <h3 className="font-black text-white mb-6 uppercase tracking-wider text-sm">Your Reinsurance Positions</h3>
                        <div className="flex items-center justify-between p-3 border border-emerald-500/20 bg-emerald-500/5 rounded-lg">
                           <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <div className="text-sm font-bold text-slate-300">Verified On-Chain Deposit</div>
                           </div>
                           <div className="flex gap-8">
                             <div className="text-right">
                               <div className="text-[10px] text-slate-500 uppercase font-black">Current Value</div>
                               <div className="text-xs font-bold text-white">{userLpBalance.toLocaleString()} XLM</div>
                             </div>
                             <div className="text-right">
                               <div className="text-[10px] text-slate-500 uppercase font-black">Pool Share</div>
                               <div className="text-xs font-bold text-white">{currentTvl > 0 ? ((userLpBalance / currentTvl) * 100).toFixed(1) : '100'}%</div>
                             </div>
                             <div className="text-right w-20">
                               <div className="text-[10px] text-slate-500 uppercase font-black">Status</div>
                               <div className="text-xs font-bold text-emerald-400">Yield Bearing</div>
                             </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {/* Staking / Provisioning Operations */}
                  <div className="glass-panel border border-white/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-sky-500/5 blur-2xl pointer-events-none" />
                    
                    <h3 className="font-black text-white mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
                      <span>🌾 Protocol Capital Operations</span>
                      {isTestnet && (
                        <span className={`text-[10px] ${'bg-sky-500/20 text-sky-400'} px-2 py-0.5 rounded font-black uppercase`}>
                          {'Testnet Sandbox'}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                      Expand the protocol's underwritten limits by contributing reinsurance capital or supporting the premium subsidy pools.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Card 1: LP Reinsurance */}
                      <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between hover:border-sky-500/20 transition-all duration-300 group">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-black text-white text-sm">💰 Reinsurance Pool (LP)</h4>
                            <span className={`text-[10px] ${'text-sky-400 bg-sky-500/10'} px-2 py-0.5 rounded font-bold`}>APY ~8.4%</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                            Stake your XLM to back parametric risk limits in exchange for premium payouts, gaining proportional yield and LP shares.
                          </p>
                        </div>
                        <div className="space-y-4">
                          {isTestnet ? (
                            <>
                              {/* Staking Mode Selector */}
                              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setStakingMode('deposit')}
                                  className={`w-1/2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    stakingMode === 'deposit'
                                      ? ('bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                                      : 'text-slate-500 hover:text-white'
                                  }`}
                                >
                                  Stake XLM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStakingMode('withdraw')}
                                  className={`w-1/2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    stakingMode === 'withdraw'
                                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                      : 'text-slate-500 hover:text-white'
                                  }`}
                                >
                                  Unstake XLM
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  placeholder="Amount in XLM"
                                  value={fundingAmount}
                                  onChange={(e) => setFundingAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                  className={`w-1/2 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${'focus:border-sky-500'} font-mono font-bold`}
                                />
                                <button
                                  onClick={() => handleContributeLiquidity('lp')}
                                  className={`w-1/2 text-white font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 ${
                                    stakingMode === 'withdraw' 
                                      ? 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)] group-hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                                      : ('bg-sky-500 hover:bg-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)] group-hover:shadow-[0_0_20px_rgba(14,165,233,0.3)]')
                                  }`}
                                >
                                  <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                  {stakingMode === 'withdraw' ? 'Unstake LP' : 'Stake LP'}
                                </button>
                              </div>

                              {/* Yield calculator sub-panel */}
                              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 space-y-2.5">
                                <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                                  <span>APY Yield Estimator</span>
                                  <div className="flex gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-white/5">
                                    {(['1m', '6m', '1y'] as const).map(p => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={() => setProjectionPeriod(p)}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                                          projectionPeriod === p ? ('bg-sky-500 text-white') : 'text-slate-500 hover:text-white'
                                        }`}
                                      >
                                        {p}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <div className="text-[8px] text-slate-500 uppercase font-black">
                                      Projected Yield ({projectionPeriod === '1m' ? '1 Month' : projectionPeriod === '6m' ? '6 Months' : '1 Year'})
                                    </div>
                                    <div className="text-sm font-black text-emerald-400 font-mono">
                                      +{((fundingAmount || userLpBalance) * 0.084 * (projectionPeriod === '1m' ? (1/12) : projectionPeriod === '6m' ? (0.5) : 1)).toFixed(2)} XLM
                                    </div>
                                    <div className="text-[8px] text-slate-500 font-bold font-mono">
                                      {formatPhp((fundingAmount || userLpBalance) * 0.084 * (projectionPeriod === '1m' ? (1/12) : projectionPeriod === '6m' ? (0.5) : 1))} PHP
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[8px] text-slate-500 uppercase font-black">Total Value</div>
                                    <div className="text-xs font-black text-white font-mono">
                                      {((fundingAmount || userLpBalance) * (1 + 0.084 * (projectionPeriod === '1m' ? (1/12) : projectionPeriod === '6m' ? (0.5) : 1))).toFixed(2)} XLM
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-500 font-bold cursor-not-allowed uppercase tracking-wider"
                            >
                              🔒 Connect Freighter on Mainnet
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card 2: Government/Donor Subsidy */}
                      <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300 group">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-black text-white text-sm">🏛️ Premium Subsidy Pool (Donor)</h4>
                            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">50% Subsidy</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                            Donate capital to subsidize half the policy premiums for smallholder farmers, protecting agricultural security.
                          </p>
                        </div>
                        <div className="space-y-3">
                          {isTestnet ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Amount in XLM"
                                value={fundingAmount}
                                onChange={(e) => setFundingAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-1/2 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                              />
                              <button
                                onClick={() => handleContributeLiquidity('subsidy')}
                                className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)] flex items-center justify-center gap-1 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                              >
                                <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                Deposit Subsidy
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-500 font-bold cursor-not-allowed uppercase tracking-wider"
                            >
                              🔒 Connect Freighter on Mainnet
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'marketplace' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <SubsidyMarketplace 
                    sponsorAddress={walletAddress} 
                    network={network}
                    addNotification={addNotification}
                  />
                </div>
              )}

              {weather && farms.length > 0 && (
                <PayoutStatus
                  weather={weather}
                  farms={farms}
                  onClaim={handleClaim}
                  network={network}
                />
              )}

              {/* Farm Intel */}
              <AssetDistribution farms={farms} />
            </div>

            {/* Right Column - Controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel">
                <h3 className="font-black text-white mb-6 uppercase tracking-widest text-sm">Quick Protocol Access</h3>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                  <button
                    onClick={() => setActiveTab('monitor')}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-center md:justify-between group transition-all gap-3 ${
                      activeTab === 'monitor' 
                        ? (isMainnet ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-sky-500/10 border-sky-500 text-sky-400') 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <Wind size={20} />
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Monitor</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-center md:justify-between group transition-all gap-3 ${
                      activeTab === 'history' 
                        ? (isMainnet ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-sky-500/10 border-sky-500 text-sky-400') 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <History size={20} />
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Claims</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('vault')}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-center md:justify-between group transition-all gap-3 ${
                      activeTab === 'vault' 
                        ? (isMainnet ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-sky-500/10 border-sky-500 text-sky-400') 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <Database size={20} />
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Vault</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('calc')}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-center md:justify-between group transition-all gap-3 ${
                      activeTab === 'calc' 
                        ? (isMainnet ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-sky-500/10 border-sky-500 text-sky-400') 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <Calculator size={20} />
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Calculator</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row items-center md:justify-between group transition-all gap-3 ${
                      activeTab === 'marketplace' 
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <Heart size={20} />
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Market</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  
                  <button
                    onClick={() => setIsEditProfileModalOpen(true)}
                    className="p-4 rounded-xl border bg-white/5 border-white/5 text-slate-400 hover:border-white/20 hover:text-white transition-all flex flex-col md:flex-row items-center md:justify-between group cursor-pointer gap-3"
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <div className={`p-1.5 rounded-lg ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                        <User size={16} />
                      </div>
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight">Profile</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setIsAddFarmModalOpen(true)}
                    className="p-4 rounded-xl border bg-white/5 border-white/5 text-slate-400 hover:border-white/20 hover:text-white transition-all flex flex-col md:flex-row items-center md:justify-between group cursor-pointer gap-3"
                  >
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                      <div className={`p-1.5 rounded-lg ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : isTestnet ? 'bg-sky-500/10 text-sky-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        <Plus size={16} />
                      </div>
                      <span className="font-bold text-[10px] md:text-sm uppercase tracking-tight text-white">Add Farm</span>
                    </div>
                    <ArrowUpRight size={18} className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>

              {isTestnet && (
                <div className="glass-panel border border-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.05)] relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl" />
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <h3 className="font-black text-white text-sm uppercase tracking-wider flex-1">🧪 Sandbox Weather Simulator</h3>
                    {isSimulatingWeather && (
                      <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Active</span>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                    Trigger simulated weather events to test the Soroban contract parametric payout logic and ledger updates in an isolated sandbox.
                  </p>
                  
                  <div className="space-y-2.5">
                    <button
                      onClick={() => handleSimulateWeather('normal')}
                      className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                        isSimulatingWeather && weather?.windSpeed === 45
                          ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">☀️</span>
                        <div>
                          <div className="font-bold">Normal Conditions</div>
                          <div className="text-[9px] text-slate-500 font-medium">45 km/h Wind | 25mm Rain (0% Payout)</div>
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateWeather('wind_trigger')}
                      className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                        isSimulatingWeather && weather?.windSpeed === 115
                          ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">💨</span>
                        <div>
                          <div className="font-bold">Moderate Typhoon</div>
                          <div className="text-[9px] text-slate-500 font-medium">115 km/h Wind | 80mm Rain (30% Payout)</div>
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateWeather('rain_trigger')}
                      className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                        isSimulatingWeather && weather?.windSpeed === 135
                          ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">🌧️</span>
                        <div>
                          <div className="font-bold">Severe Typhoon</div>
                          <div className="text-[9px] text-slate-500 font-medium">135 km/h Wind | 220mm Rain (70% Payout)</div>
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                    </button>

                    <button
                      onClick={() => handleSimulateWeather('double_trigger')}
                      className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                        isSimulatingWeather && weather?.windSpeed === 165
                          ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                          : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">🌀</span>
                        <div>
                          <div className="font-bold">Super Typhoon</div>
                          <div className="text-[9px] text-slate-500 font-medium">165 km/h Wind | 350mm Rain (100% Payout)</div>
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                    </button>

                    {isSimulatingWeather && (
                      <button
                        onClick={handleResetWeather}
                        className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={12} className="animate-spin-slow" />
                        Revert to Live API Feeds
                      </button>
                    )}
                  </div>
                </div>
              )}

              {farms.length > 0 && (
                <AiCopilot
                  accountId={walletAddress}
                  weather={weather}
                  farms={farms}
                  claims={claims}
                  addNotification={addNotification}
                  onUpdateWeatherDamage={(damage, status, aiDamage, confidence) => {
                    setWeather(prev => prev ? {
                      ...prev,
                      damageEstimation: damage,
                      aiDamageEstimation: aiDamage,
                      agromonitorStatus: status
                    } : null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Premium Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 relative z-10">
        <div>
          © {new Date().getFullYear()} TyFi. Underwritten Parametric Pool. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
          <button onClick={() => setOpenPolicy('tos')} className="hover:text-white transition-colors">Terms of Service</button>
          <button onClick={() => setOpenPolicy('privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
          <button onClick={() => setOpenPolicy('cookie')} className="hover:text-white transition-colors">Cookie Policy</button>
          <button onClick={() => setOpenPolicy('agreement')} className={`font-black transition-colors ${isMainnet ? 'text-emerald-500 hover:text-emerald-400' : 'text-sky-500 hover:text-sky-400'}`}>Parametric Insurance Agreement</button>
        </div>
      </footer>

      {/* Legal Modals Overlay */}
      {openPolicy && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                {openPolicy === 'tos' && 'Terms of Service'}
                {openPolicy === 'privacy' && 'Privacy Policy'}
                {openPolicy === 'cookie' && 'Cookie Policy'}
                {openPolicy === 'agreement' && 'Parametric Insurance Agreement'}
              </h3>
              <button
                onClick={() => setOpenPolicy(null)}
                className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all text-xs font-black uppercase tracking-wider border border-white/10"
              >
                Close
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed custom-scrollbar">
              {openPolicy === 'tos' && (
                <>
                  <p>Welcome to the TyFi (the "Platform"). By connecting your Freighter wallet and registering a farm coordinate polygon, you agree to these Terms of Service.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">1. Sandbox vs Production Operational Networks</h4>
                  <p>The Platform offers two operational states: Testnet Sandbox and Mainnet. Testnet Sandbox operations represent pure parametric simulations utilizing test assets and dummy signatures. Mainnet transactions constitute legally binding, smart-contract-governed parametric insurance pooling anchored directly to the Stellar Public Ledger.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">2. Decentralized Smart Contract Underwriting</h4>
                  <p>By registering, you acknowledge that insurance underwriting, premium distribution, claims verification, and capital disbursals are executed autonomously by decentralized Web3 smart contracts compiled in Rust and running on Soroban. The Protocol holds zero administrative backdoors; hence, premium transfers are non-refundable once committed to the liquidity pools.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">3. Oracle Consensus and Mathematical Rigor</h4>
                  <p>Payout metrics are strictly derived from independent oracle aggregates (including Open-Meteo, GDACS, and weather satellite feeds). By utilizing this system, you agree to accept oracle-relayed measurements as absolute mathematical truth. No physical damage assessments, adjustments, or manual appeals will be accommodated.</p>
                </>
              )}

              {openPolicy === 'privacy' && (
                <>
                  <p>The TyFi is built with absolute transparency and data minimization. We prioritize local storage and public cryptographic standards.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">1. Geospatial and Farm Coordinate Polygons</h4>
                  <p>To register your farm for parametric tracking, you must supply exact GPS coordinates (Latitude and Longitude). This geospatial data is published on-chain to the public Stellar ledger to facilitate coordinate-matching triggers by decentralized oracles. By using this service, you consent to the public, immutable broadcast of your farm's coordinate bounds.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">2. Personal Information and Government IDs</h4>
                  <p>The Platform integrates with the Philippine Registry System for Basic Sectors in Agriculture (RSBSA). Your RSBSA enrollment details and phone number are processed strictly client-side to verify agricultural standing. They are cached locally in your browser's encrypted state storage to enable resilient session restoring. We do not maintain any centralized web server database storing your identity credentials.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">3. Push Warning Dispatches</h4>
                  <p>If you consent to receive push notifications for active typhoons, your browser endpoint token is securely queued with our FCM warning dispatcher. This dispatch utilizes no tracking scripts and serves purely for emergency proximity alerts.</p>
                </>
              )}

              {openPolicy === 'cookie' && (
                <>
                  <p>The TyFi operates as a sovereign, client-side Web3 portal. We implement a strict zero-cookie tracking policy.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">1. Zero Web Trackers or Third-Party Cookies</h4>
                  <p>We do not use any marketing cookies, tracking pixels, or third-party web analytics (such as Google Analytics or Facebook Pixels). Your movements through our dashboard are never recorded, aggregated, or shared with corporate advertising entities.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">2. Resilient Browser Local Storage</h4>
                  <p>To provide a highly resilient session experience and protect active workspaces from accidental page refreshes, we utilize standard HTML5 Local Storage (`localStorage`). This stores local session indicators including your active tab selection, network choice, wallet connection state, public wallet address, verified farm details, and historical claim logs. This information never leaves your browser sandbox.</p>
                </>
              )}

              {openPolicy === 'agreement' && (
                <>
                  <p className="border-l-2 border-sky-500 pl-4 italic text-slate-400">
                    This Parametric Insurance Agreement governs the mutual risk-pooling program between the registered Farmer (represented by their Stellar Public Address) and the decentralized TyFi liquidity pool.
                  </p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">1. The Parametric Underwriting Mechanics</h4>
                  <p>Unlike traditional indemnity crop insurance which requires lengthy physical farm audits to determine crop damage, this protocol utilizes <strong>Parametric triggers</strong>. Payouts are made instantly and automatically based on objective, immutable meteorological measurements recorded by the consensus oracle system.</p>
                  
                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">2. Precise Meteorological Trigger Thresholds</h4>
                  <p>The program enforces strict, mathematically absolute triggers to determine eligibility for liquidity disbursals:</p>
                  
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                    <div>
                      <span className="font-black text-white text-xs block mb-1">A. WIND TRIGGER</span>
                      <ul className="list-disc pl-5 space-y-1 text-xs">
                        <li><strong>Testnet Sandbox (Sliding Scale):</strong> Wind speed gusts measuring between 100 km/h and 120 km/h disburse a 20% partial payout. Gusts between 120 km/h and 150 km/h disburse a 50% partial payout. Wind speed gusts &ge; 150 km/h trigger a 100% full payout.</li>
                        <li><strong>Mainnet (Strict Binary):</strong> Wind speed gusts must strictly reach or exceed <strong>150 km/h</strong> (Category 2+ Typhoon equivalent) to trigger a 100% payout of the total crop value. No partial wind payouts are underwritten on Mainnet to protect the reserve capital pools.</li>
                      </ul>
                    </div>

                    <div>
                      <span className="font-black text-white text-xs block mb-1">B. PRECIPITATION / FLOOD TRIGGER</span>
                      <ul className="list-disc pl-5 space-y-1 text-xs">
                        <li>Cumulative liquid rainfall measuring &ge; <strong>200 mm</strong> within a continuous 24-hour window, measured within a 10-kilometer radius of the registered farm coordinates. This triggers a 100% payout on both Testnet and Mainnet.</li>
                      </ul>
                    </div>
                  </div>

                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">3. Oracle Consensus Verification</h4>
                  <p>Measurements are validated through decentralized consensus across three distinct data feeds: Open-Meteo API (historical re-analysis grid), GDACS (Global Disaster Alert and Coordination System) active storm track bounds, and satellite microwave precipitation radiometry. The smart contract acts immediately upon consensus, depositing native <strong>XLM</strong> directly to the registered wallet.</p>

                  <h4 className="font-bold text-white uppercase text-xs tracking-wider">4. Premium and Capital Structure</h4>
                  <p>Premiums are split equally under a 50/50 model: 50% paid by the Farmer's direct deposit, and 50% subsidized by the Government/Donor subsidy pool. Disbursals are backed by over-collateralized Liquidity Provider pools, ensuring a vault reserve ratio of at least 300% is maintained at all times.</p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setOpenPolicy(null)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all ${
                  isMainnet 
                    ? 'bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20' 
                    : 'bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/20'
                }`}
              >
                I Understand & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signout Confirmation Modal Overlay */}
      {isSignoutConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Disconnect Wallet?</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to disconnect your Stellar wallet and sign out? You will need to reconnect to view your active vault assets.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsSignoutConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDisconnect();
                  setIsSignoutConfirmOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 Profile Dashboard Modal */}
      {isProfileDashboardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsProfileDashboardOpen(false)}></div>
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
                  <User size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase italic">Farmer Profile Dashboard</h2>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Protocol Participant Information</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <select
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  value={i18n.language}
                  className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50 appearance-none cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="tl">Tagalog</option>
                  <option value="ceb">Cebuano</option>
                  <option value="war">Waray</option>
                </select>
                <button 
                  onClick={() => setIsProfileDashboardOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Farmer Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Farmer Name', value: profileForm.farmerName, icon: User },
                  { label: 'RSBSA Number', value: profileForm.rsbsaNumber, icon: Shield },
                  { label: 'Primary Region', value: profileForm.region, icon: MapPin },
                  { label: 'Phone Number', value: profileForm.phoneNumber, icon: Phone },
                ].map((info, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <info.icon size={12} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{info.label}</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">{info.value || 'Not Set'}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Farms List */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Sprout size={14} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                      Insured Farm Assets ({farms.length})
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {farms.length === 0 ? (
                      <div className="p-12 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 gap-3">
                        <Sprout size={40} opacity={0.2} />
                        <p className="text-sm font-bold">No farms registered under this profile.</p>
                        <button 
                          onClick={() => {
                            setIsProfileDashboardOpen(false);
                            setIsAddFarmModalOpen(true);
                          }}
                          className="text-xs text-sky-400 font-black uppercase tracking-widest hover:underline"
                        >
                          + Register Your First Farm
                        </button>
                      </div>
                    ) : (
                      farms.map((farm) => (
                        <div key={farm.id} className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                                isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
                              }`}>
                                <Sprout size={24} />
                              </div>
                              <div>
                                <h4 className="font-bold text-white uppercase italic">{farm.farmName}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                                  }`}>
                                    {farm.cropType}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                    {farm.farmSize} Hectares • {farm.season}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-white">{farm.totalCropValue.toLocaleString()} XLM</div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Valuation</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
                              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1">Production Cost</span>
                              <span className="text-xs font-bold text-slate-300">{farm.initialInvestment?.toLocaleString()} XLM</span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
                              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1">Expected Harvest</span>
                              <span className="text-xs font-bold text-slate-300">{farm.expectedHarvestValue?.toLocaleString()} XLM</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                <MapPin size={10} />
                                {farm.latitude?.toFixed(4)}, {farm.longitude?.toFixed(4)}
                              </div>
                              {farm.landDocument && (
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-black uppercase tracking-tight">
                                  <ShieldCheck size={10} />
                                  Ownership Verified
                                </div>
                              )}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${
                              farm.hasClaimed 
                                ? 'bg-emerald-500 text-white' 
                                : (weather && (weather.windSpeed > 100 || weather.rainfall > 200) ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/10 text-slate-500')
                            }`}>
                              {farm.hasClaimed ? 'CLAIMED' : (weather && (weather.windSpeed > 100 || weather.rainfall > 200) ? 'TRIGGERED' : 'SECURED')}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: History & Actions */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Certificates Section */}
                  <div className="glass-panel p-6 bg-white/5 border-white/10">
                    <CertificateList address={walletAddress} network={network} />
                  </div>

                  <div className="glass-panel p-6 bg-white/5 border-white/10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Bell size={14} className="text-indigo-400" />
                      Notification History
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {notificationHistory.length === 0 ? (
                        <p className="text-xs text-slate-600 text-center py-8">No past notifications.</p>
                      ) : (
                        notificationHistory.map((notif) => (
                          <div key={notif.id} className="p-3 rounded-xl bg-slate-950/50 border border-white/5 flex gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              notif.type === 'success' ? 'bg-emerald-500' : 
                              notif.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                            }`}></div>
                            <div className="space-y-1 flex-1">
                              <p className="text-[11px] text-slate-300 leading-normal">{notif.text}</p>
                              <p className="text-[9px] text-slate-600 font-bold uppercase">
                                {new Date(notif.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        setIsProfileDashboardOpen(false);
                        setIsEditProfileModalOpen(true);
                      }}
                      className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 border ${
                        isMainnet 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20'
                      }`}
                    >
                      <Lock size={16} />
                      Update Profile Settings
                    </button>
                    <button 
                      onClick={() => {
                        setIsProfileDashboardOpen(false);
                        setIsSignoutConfirmOpen(true);
                      }}
                      className="w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase text-rose-500 hover:bg-rose-500/10 transition-all border border-rose-500/20"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 text-center border-t border-white/5">
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">
                TyFi • On-Chain Identity Proof • {network.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal Overlay */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-wider">Edit Farmer Profile</h3>
              <button 
                onClick={() => setIsEditProfileModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditProfileSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Farmer's Full Name</label>
                <input 
                  type="text" 
                  value={profileForm.farmerName}
                  onChange={(e) => setProfileForm({ ...profileForm, farmerName: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">RSBSA ID Number</label>
                <input 
                  type="text" 
                  value={profileForm.rsbsaNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, rsbsaNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                  placeholder="05-16-01-000-00000"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Region</label>
                  <select 
                    value={profileForm.region}
                    onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                  >
                    <option>Central Luzon</option>
                    <option>Bicol Region</option>
                    <option>Eastern Visayas</option>
                    <option>Western Visayas</option>
                    <option>Cagayan Valley</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Phone Number</label>
                  <input 
                    type="tel" 
                    value={profileForm.phoneNumber}
                    onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                    placeholder="+63 9XX XXX XXXX"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                  <div className="text-emerald-500 font-bold text-xs">✓ RSBSA Verified</div>
                  <div className="text-[9px] text-slate-500 truncate">{profileForm.uploadedRsbsa || 'demo-rsbsa.pdf'}</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                  <div className="text-emerald-500 font-bold text-xs">✓ Gov ID Verified</div>
                  <div className="text-[9px] text-slate-500 truncate">{profileForm.uploadedValidId || 'demo-id.png'}</div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg cursor-pointer ${
                    isMainnet 
                      ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' 
                      : 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Farm Modal Overlay */}
      {isAddFarmModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sprout className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} size={20} />
                Register & Insure New Farm
              </h3>
              <button 
                onClick={() => setIsAddFarmModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddFarmSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Farm Identity & Location */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Farm Name / Identifier</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        value={newFarmForm.farmName}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, farmName: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                        placeholder="e.g. Albay Paradise Farm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Crop Type</label>
                      <select 
                        value={newFarmForm.cropType}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, cropType: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                      >
                        <option>Rice</option>
                        <option>Corn</option>
                        <option>Coconut</option>
                        <option>Abaca</option>
                        <option>Banana</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Planting Date</label>
                      <input 
                        type="date" 
                        value={newFarmForm.plantingDate}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, plantingDate: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Size (Ha)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={newFarmForm.farmSize}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, farmSize: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cost (XLM)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={newFarmForm.initialInvestment}
                          readOnly
                          className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-2.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Val (XLM)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={newFarmForm.expectedHarvestValue}
                          readOnly
                          className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-2.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {modalValuationExplanation && (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-extrabold text-white block mb-0.5">🌾 Crop Valuation Model (Confidence: {modalValuationConfidence}%)</span>
                      {modalValuationExplanation}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400 font-black uppercase tracking-wider">📍 Farm Location Search (OpenStreetMap)</span>
                      {newFarmForm.latitude !== undefined && (
                        <span className="text-[8px] text-emerald-400 font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {newFarmForm.latitude.toFixed(4)}, {newFarmForm.longitude.toFixed(4)}
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="modal-location-search-input"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold" 
                        placeholder="e.g. Guinobatan, Albay" 
                      />
                      <button
                        type="button"
                        id="modal-location-search-btn"
                        onClick={async () => {
                          const input = document.getElementById("modal-location-search-input") as HTMLInputElement;
                          const btn = document.getElementById("modal-location-search-btn") as HTMLButtonElement;
                          const query = input?.value?.trim();
                          if (!query) return;
                          btn.textContent = '...';
                          btn.disabled = true;
                          try {
                            const res = await fetch(
                              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Philippines')}&format=json&limit=1&countrycodes=ph`,
                              { headers: { 'Accept-Language': 'en', 'User-Agent': 'TyphoonResilienceVault/1.0' } }
                            );
                            const data = await res.json();
                            if (data && data.length > 0) {
                              const lat = parseFloat(data[0].lat);
                              const lng = parseFloat(data[0].lon);
                              const displayName = data[0].display_name;
                              setNewFarmForm(prev => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng
                              }));
                              input.value = displayName;
                            } else {
                              input.style.borderColor = 'rgb(239 68 68 / 0.5)';
                              setTimeout(() => { input.style.borderColor = ''; }, 2000);
                            }
                          } catch (err) {
                            console.error("Nominatim geocoding error:", err);
                          } finally {
                            btn.textContent = 'Search';
                            btn.disabled = false;
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isMainnet 
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                        }`}
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sat Hybrid Map & Land Ownership Upload */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">🗺️ Pinpoint Farm Location</label>
                    <div className="h-[150px] w-full rounded-xl overflow-hidden border border-white/10 relative z-10">
                      <MapContainer
                        center={[
                          newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                          newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                        ]}
                        zoom={12}
                        scrollWheelZoom={false}
                        className="w-full h-full"
                      >
                        <TileLayer
                          attribution='© Google Maps'
                          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        />
                        <MapEventsHandler 
                          onChange={(lat, lng) => {
                            setNewFarmForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                          }}
                        />
                        <FlyToCenter 
                          center={[
                            newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                            newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                          ]} 
                        />
                        <Marker
                          position={[
                            newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                            newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                          ]}
                          draggable={true}
                          eventHandlers={{
                            dragend(e) {
                              const marker = e.target;
                              if (marker) {
                                const latLng = marker.getLatLng();
                                setNewFarmForm(prev => ({
                                  ...prev,
                                  latitude: latLng.lat,
                                  longitude: latLng.lng
                                }));
                              }
                            }
                          }}
                          icon={L.divIcon({
                            html: renderToStaticMarkup(
                              <div style={{ color: isMainnet ? '#10b981' : '#0ea5e9', filter: `drop-shadow(0 0 6px ${isMainnet ? '#10b98180' : '#0ea5e980'})` }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                              </div>
                            ),
                            className: '',
                            iconSize: [24, 24],
                            iconAnchor: [12, 24],
                          })}
                        />
                      </MapContainer>
                    </div>
                  </div>

                  {/* Land Ownership Proof Section */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FileText size={12} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                      Land Ownership Proof
                      <span className="text-rose-400">*</span>
                    </label>

                    {/* Doc Type Selector */}
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                      <button
                        type="button"
                        onClick={() => setModalLandDocType('land_title')}
                        className={`w-1/2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          modalLandDocType === 'land_title'
                            ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        🏛️ Land Title
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalLandDocType('deed_of_sale')}
                        className={`w-1/2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          modalLandDocType === 'deed_of_sale'
                            ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        📄 Deed of Sale
                      </button>
                    </div>

                    {/* File Picker */}
                    <input
                      type="file"
                      id="modal-land-doc-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setModalIsUploadingLandDoc(true);
                          setTimeout(() => {
                            setModalIsUploadingLandDoc(false);
                            setModalUploadedLandDoc(file.name);
                          }, 1500);
                        }
                      }}
                    />
                    <label
                      htmlFor="modal-land-doc-upload"
                      className={`file-upload-container group block cursor-pointer border border-dashed border-white/10 hover:border-white/20 rounded-2xl p-4 text-center transition-all bg-white/[0.02] ${modalUploadedLandDoc ? 'bg-emerald-500/5 border-emerald-500/20' : ''}`}
                    >
                      {modalIsUploadingLandDoc ? (
                        <div className="py-1 flex flex-col items-center">
                          <Loader2
                            className={`animate-spin mb-1 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}
                            size={20}
                          />
                          <p className={`font-bold text-[10px] animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
                            Scanning Document...
                          </p>
                        </div>
                      ) : modalUploadedLandDoc ? (
                        <div className="py-1 flex flex-col items-center">
                          <CheckCircle2 className="text-emerald-500 mb-1" size={20} />
                          <p className="text-white font-bold text-[10px] truncate max-w-[180px]">
                            {modalUploadedLandDoc}
                          </p>
                          <p className="text-emerald-400 text-[8px] font-bold mt-0.5">
                            ✓ {modalLandDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'} Verified
                          </p>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModalUploadedLandDoc(null); }}
                            className="mt-1 text-[8px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
                          >
                            Replace file
                          </button>
                        </div>
                      ) : (
                        <div className="py-1 flex flex-col items-center">
                          <Upload
                            className={`upload-icon mb-1 text-slate-400 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'}`}
                            size={20}
                          />
                          <p className="text-white font-bold text-[10px] mb-0.5">
                            Upload {modalLandDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'}
                          </p>
                          <p className="text-slate-500 text-[8px]">PDF, JPG, PNG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddFarmModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalUploadedLandDoc || !newFarmForm.farmName}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isMainnet 
                      ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' 
                      : 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'
                  }`}
                >
                  {!modalUploadedLandDoc ? 'Upload Land Document' : 'Insure Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Overlay */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 max-w-sm w-full">
        {notifications.map(note => (
          <div
            key={note.id}
            className={`p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-right shadow-2xl ${
              note.type === 'success' 
                ? 'bg-emerald-500 text-white border-emerald-400' 
                : note.type === 'warning' 
                  ? 'bg-amber-500 text-white border-amber-400' 
                  : 'bg-slate-900 text-white border-white/10 backdrop-blur-xl'
            }`}
          >
            {note.type === 'success' ? <CheckCircle2 size={20} /> : note.type === 'warning' ? <AlertCircle size={20} /> : <Info size={20} />}
            <span className="text-sm font-bold">{note.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
