import type { FastifyRequest, FastifyReply } from "fastify";

export interface AdminSessionData {
  adminUserId: string;
  username: string;
}

declare module "fastify" {
  interface Session {
    admin?: AdminSessionData;
  }
}

export function requireAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): AdminSessionData | null {
  const admin = request.session.admin;
  if (!admin?.adminUserId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return admin;
}
