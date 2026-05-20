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
