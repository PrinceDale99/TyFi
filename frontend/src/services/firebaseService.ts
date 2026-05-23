import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp,
  type DocumentData
} from "firebase/firestore";
import { db } from "../firebase";

export interface PredictionLog extends DocumentData {
  farmerAddress: string;
  farmName: string;
  riskLevel: string;
  hitProbability: number;
  estimatedDamage: number;
  reasoning: string;
  advisory: string;
  timestamp: any;
}

export interface PayoutLog extends DocumentData {
  farmerAddress: string;
  amount: number;
  region: string;
  timestamp: any;
}

export const logPrediction = async (prediction: Omit<PredictionLog, 'timestamp'>) => {
  try {
    const docRef = await addDoc(collection(db, "predictions"), {
      ...prediction,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding prediction log: ", e);
    return null;
  }
};

export const getPredictionHistory = async (farmerAddress: string, maxResults = 10) => {
  try {
    const q = query(
      collection(db, "predictions"),
      where("farmerAddress", "==", farmerAddress),
      orderBy("timestamp", "desc"),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any)) as PredictionLog[];
  } catch (e) {
    console.error("Error getting prediction history: ", e);
    return [];
  }
};

export const getPayoutHistory = async (farmerAddress: string, maxResults = 10) => {
  try {
    const q = query(
      collection(db, "payouts"),
      where("farmerAddress", "==", farmerAddress),
      orderBy("timestamp", "desc"),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any)) as PayoutLog[];
  } catch (e) {
    console.error("Error getting payout history: ", e);
    return [];
  }
};

/**
 * Registers a farm for the Subsidy Marketplace.
 */
export const registerForSubsidy = async (farmerAddress: string, farm: any, network: string = 'testnet') => {
  try {
    const totalPremium = Math.round(farm.expectedHarvestValue * 0.1);
    const subsidyPercent = (farm.govSubsidyPercent || 0) + (farm.ngoSubsidyPercent || 0);
    const subsidyAmount = Math.round(totalPremium * (subsidyPercent / 100));
    const premiumNeeded = Math.max(0, totalPremium - subsidyAmount);

    await addDoc(collection(db, "subsidy_requests"), {
      farmerAddress: farmerAddress || 'Unknown Address',
      farmerName: farm.farmerName || 'Unknown Farmer',
      farmName: farm.farmName || 'Unknown Farm',
      cropType: farm.cropType || 'Mixed Crops',
      region: farm.region || 'Unknown Region',
      farmSize: farm.farmSize || 1,
      totalPremium: totalPremium || 0,
      govSubsidyPercent: farm.govSubsidyPercent || 0,
      ngoSubsidyPercent: farm.ngoSubsidyPercent || 0,
      premiumNeeded: premiumNeeded || 0,
      paymentPlan: farm.paymentPlan || 'full',
      harvestValue: farm.expectedHarvestValue || 0,
      season: farm.season || 'Current Season',
      isFunded: false,
      network: network,
      timestamp: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error("Error registering for subsidy: ", e);
    return false;
  }
};

/**
 * Retrieves all active subsidy requests for sponsors to browse.
 */
export const getActiveSubsidyRequests = async (network: string = 'testnet') => {
  try {
    const q = query(
      collection(db, "subsidy_requests"),
      where("isFunded", "==", false),
      where("network", "==", network)
    );
    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
    
    return docs.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return timeB - timeA;
    });
  } catch (e) {
    console.error("Error getting subsidy requests: ", e);
    return [];
  }
};
