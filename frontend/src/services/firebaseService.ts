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
export const registerForSubsidy = async (farmerAddress: string, farm: any) => {
  try {
    await addDoc(collection(db, "subsidy_requests"), {
      farmerAddress,
      farmerName: farm.farmerName,
      farmName: farm.farmName,
      cropType: farm.cropType,
      region: farm.region,
      farmSize: farm.farmSize,
      premiumNeeded: Math.round(farm.expectedHarvestValue * 0.1),
      harvestValue: farm.expectedHarvestValue,
      season: farm.season,
      isFunded: false,
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
export const getActiveSubsidyRequests = async () => {
  try {
    const q = query(
      collection(db, "subsidy_requests"),
      where("isFunded", "==", false),
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
  } catch (e) {
    console.error("Error getting subsidy requests: ", e);
    return [];
  }
};
