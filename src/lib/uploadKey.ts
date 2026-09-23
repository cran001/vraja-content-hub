// A retry of the same file and metadata in the same tab reuses its key. Metadata changes
// deliberately create a new upload request. The server rejects conflicting key reuse.
const keys = new WeakMap<File, Map<string, string>>();
export function uploadKey(file: File, form: FormData): string {
  const metadata = JSON.stringify(Array.from(form.entries()).filter(([,value]) => typeof value === 'string'));
  let versions = keys.get(file);
  if (!versions) { versions = new Map(); keys.set(file,versions); }
  let key = versions.get(metadata);
  if (!key) { key = crypto.randomUUID(); versions.set(metadata,key); }
  return key;
}
