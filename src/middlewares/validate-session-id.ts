import { FastifyReply, FastifyRequest } from "fastify";

export default async function validateSessionId(
  req: FastifyRequest,
  res: FastifyReply
) {
  const cookies = req.headers.cookie;

  if (!cookies) {
    return res.code(401).send({ message: "Unauthorized" });
  }
}
