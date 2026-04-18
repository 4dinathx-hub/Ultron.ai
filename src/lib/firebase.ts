import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json'; // Adjust path if needed

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// Core test to validate connection to Firestore Matrix
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message && error.message.includes('the client is offline')) {
      console.error("Ultron: Firebase Core connection is offline.");
    }
  }
}
testConnection();

export async function loginAndEnsureUser() {
  const userCred = await signInAnonymously(auth);
  const uid = userCred.user.uid;
  
  // Try to create the root user profile if it doesn't exist
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDocFromServer(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        createdAt: serverTimestamp()
      });
    }
  } catch(e) {
    console.error("Ultron: Failed to ensure user DB node. (This is normal if rules block reads but allow creates).");
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        createdAt: serverTimestamp()
      });
    } catch(err) {} 
  }
  return uid;
}

export async function saveMemoryToDb(userId: string, content: string, type: 'query' | 'response' | 'learned_fact') {
  try {
    const memRef = collection(db, 'users', userId, 'memories');
    await addDoc(memRef, {
      userId,
      content,
      type,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Ultron: Error syncing memory to mainframe: ", e);
  }
}
