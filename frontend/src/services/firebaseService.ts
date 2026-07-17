import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
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
  network: string;
  timestamp: any;
}

export interface PayoutLog extends DocumentData {
  farmerAddress: string;
  amount: number;
  region: string;
  network: string;
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

export const getPredictionHistory = async (farmerAddress: string, network: string = 'testnet', maxResults = 10) => {
  try {
    const q = query(
      collection(db, "predictions"),
      where("farmerAddress", "==", farmerAddress),
      where("network", "==", network),
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

export const getPayoutHistory = async (farmerAddress: string, network: string = 'testnet', maxResults = 10) => {
  try {
    const q = query(
      collection(db, "payouts"),
      where("farmerAddress", "==", farmerAddress),
      where("network", "==", network),
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

export const logPayout = async (payoutData: Omit<PayoutLog, 'id' | 'timestamp'>) => {
  try {
    const docRef = await addDoc(collection(db, "payouts"), {
      ...payoutData,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error("Error logging payout: ", e);
    return null;
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
    const docs = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any));
    
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

/**
 * Retrieves farms that a specific sponsor has funded.
 */
export const getSponsoredFarms = async (sponsorAddress: string, network: string = 'testnet') => {
  try {
    const q = query(
      collection(db, "subsidy_requests"),
      where("isFunded", "==", true),
      where("fundedBy", "==", sponsorAddress),
      where("network", "==", network)
    );
    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    return docs.sort((a, b) => {
      const timeA = a.fundedAt ? new Date(a.fundedAt).getTime() : 0;
      const timeB = b.fundedAt ? new Date(b.fundedAt).getTime() : 0;
      return timeB - timeA;
    });
  } catch (e) {
    console.error("Error getting sponsored farms: ", e);
    return [];
  }
};

/**
 * Removes a farm from the Subsidy Marketplace.
 */
export const unlistFromSubsidy = async (requestId: string) => {
  try {
    await deleteDoc(doc(db, "subsidy_requests", requestId));
    return true;
  } catch (e) {
    console.error("Error unlisting subsidy request: ", e);
    return false;
  }
};

/**
 * Registers a Sponsor/Donor/NGO profile in Firestore.
 */
export const registerSponsor = async (walletAddress: string, sponsorInfo: any, network: string = 'testnet') => {
  try {
    const docRef = await addDoc(collection(db, "sponsors"), {
      walletAddress: walletAddress,
      name: sponsorInfo.name,
      email: sponsorInfo.email,
      birthDate: sponsorInfo.birthDate,
      sponsorType: sponsorInfo.sponsorType,
      network: network,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error registering sponsor: ", e);
    return null;
  }
};

/**
 * Retrieves a user's unified profile (role, farms, etc.) from Firebase.
 */
export const getUserProfile = async (walletAddress: string, network: string = 'testnet') => {
  try {
    const docRef = doc(db, "user_profiles", `${network}_${walletAddress}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (e) {
    console.error("Error getting user profile: ", e);
    return null;
  }
};

/**
 * Saves or updates a user's unified profile in Firebase.
 */
export const saveUserProfile = async (walletAddress: string, profileData: any, network: string = 'testnet') => {
  try {
    const docRef = doc(db, "user_profiles", `${network}_${walletAddress}`);
    
    // 1. Merge all intended data
    const rawData = {
      ...profileData,
      walletAddress,
      network,
    };

    // 2. Strip out any 'undefined' values to satisfy Firebase constraints
    const cleanData = Object.fromEntries(
      Object.entries(rawData).filter(([_, v]) => v !== undefined)
    );

    // 3. Save the clean payload
    await setDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Error saving user profile: ", e);
    return false;
  }
};
