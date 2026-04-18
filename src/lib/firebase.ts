import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
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

export function subscribeToAuth(callback: (uid: string | null) => void) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (user.isAnonymous) {
         try { await auth.signOut(); } catch(e) {}
         callback(null);
         return;
      }
      const uid = user.uid;
      try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
          uid,
          createdAt: serverTimestamp(),
          email: user.email
        }, { merge: true });
      } catch(e) {
        console.error("Ultron: Failed to ensure user DB node.", e);
      }
      callback(uid);
    } else {
      callback(null);
    }
  });
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("Ultron: Login failed -", error.message);
    throw error;
  }
}

export async function saveMemoryToDb(userId: string | null, content: string, type: 'query' | 'response' | 'learned_fact') {
  if (!userId) return; // Do not save if not logged in
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

export async function retrieveMemories(userId: string | null, limitCount: number = 20): Promise<any[]> {
  if (!userId) return [];
  try {
    const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
    const memRef = collection(db, 'users', userId, 'memories');
    const q = query(memRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    const memories: any[] = [];
    snapshot.forEach(doc => {
      memories.push({ id: doc.id, ...doc.data() });
    });
    return memories.reverse(); // Return in chronological order
  } catch (e) {
    console.error("Ultron: Error retrieving memories: ", e);
    return [];
  }
}
