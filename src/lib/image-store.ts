// Image blobs live in IndexedDB; board metadata remains in the existing localStorage key.
const DB_NAME = 'phaseboard-images-v6';
const STORE = 'images';
function openDb(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function transact<T>(mode:IDBTransactionMode, action:(store:IDBObjectStore, resolve:(value:T)=>void, reject:(error:unknown)=>void)=>void):Promise<T>{
 const db=await openDb();
 return new Promise<T>((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);
  const store=tx.objectStore(STORE);
  let result:T; let resolved=false;
  const done=(value:T)=>{result=value;resolved=true;};
  tx.oncomplete=()=>{db.close();if(resolved)resolve(result);else reject(new Error('Image operation incomplete'));};
  tx.onerror=()=>{db.close();reject(tx.error);};
  tx.onabort=()=>{db.close();reject(tx.error);};
  action(store,done,reject);
 });
}
export const saveImage=(id:string,file:Blob)=>transact<void>('readwrite',(s,done)=>{s.put(file,id);done(undefined);});
export const loadImage=(id:string)=>transact<Blob|undefined>('readonly',(s,done)=>{const r=s.get(id);r.onsuccess=()=>done(r.result as Blob|undefined);});
export const deleteImage=(id:string)=>transact<void>('readwrite',(s,done)=>{s.delete(id);done(undefined);});
