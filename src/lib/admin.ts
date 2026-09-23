import { jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { inTransaction, query } from './db';
import { ApiError, failure, UUID } from './api';

export type Account = { id: string; role: 'super_admin' | 'community_admin'; community_name: string | null };
export async function account(req: Request): Promise<Account> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || !process.env.JWT_SECRET) throw new ApiError(401, 'Authentication required.');
  let userId: unknown;
  try {
    const { payload } = await jwtVerify(header.slice(7), new TextEncoder().encode(process.env.JWT_SECRET), { algorithms: ['HS256'] });
    if (typeof payload.exp !== 'number') throw new Error('Expiration required');
    userId = payload.userId;
  } catch { throw new ApiError(401, 'Invalid or expired token.'); }
  if (typeof userId !== 'string' || !UUID.test(userId)) throw new ApiError(401, 'Invalid account.');
  const { rows } = await query('SELECT id, role, community_name FROM admins WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user || !['super_admin', 'community_admin'].includes(user.role)) throw new ApiError(403, 'Account has no valid role.');
  return user;
}

/** Shared publishing is super-admin only. Community contributions use a separately
 * scoped draft endpoint; display-only community_name never grants tenant privileges. */
export function withAdmin(handler: (req: NextRequest) => Promise<Response>, allowCommunity = false, transactional = true) {
  return async (req: NextRequest) => {
    try {
      const user = await account(req);
      if (user.role !== 'super_admin' && !allowCommunity) throw new ApiError(403, 'This operation requires a super administrator.');
      const headers = new Headers(req.headers);
      headers.set('x-user-id', user.id);
      headers.set('x-user-role', user.role);
      headers.delete('x-user-email');
      // The production adapter's Request may belong to another bundled constructor.
      // Rebuild from its URL/stream instead of relying on instanceof Request cloning.
      const hasBody=req.method!=='GET'&&req.method!=='HEAD';
      const trusted = new NextRequest(req.url, {method:req.method,headers,
        ...(hasBody?{body:req.body,duplex:'half'}:{})});
      return transactional ? await inTransaction(() => handler(trusted), user.id) : await handler(trusted);
    } catch (error) { return failure(error); }
  };
}
