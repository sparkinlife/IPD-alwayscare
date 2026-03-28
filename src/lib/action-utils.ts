import { Prisma } from "@prisma/client";

export class ActionUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionUserError";
  }
}

function extractErrorMetadata(error: unknown): Record<string, unknown> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      kind: "PrismaClientKnownRequestError",
      code: error.code,
      meta: error.meta,
    };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { kind: "PrismaClientValidationError" };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { kind: "PrismaClientInitializationError", code: error.errorCode };
  }
  if (error instanceof Error) {
    return { kind: error.name };
  }
  return { kind: typeof error };
}

export function handleActionError(error: unknown): { error: string } {
  // Re-throw Next.js internal throws (redirects, not-found, etc.)
  if (error && typeof error === "object" && "digest" in error) throw error;

  const metadata = extractErrorMetadata(error);
  console.error("[action-error]", {
    ...metadata,
    message: error instanceof Error ? error.message : String(error),
  });

  if (error instanceof ActionUserError) return { error: error.message };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { error: "This record already exists" };
    if (error.code === "P2003")
      return { error: "This action could not be completed because related data is missing" };
    if (error.code === "P2025") return { error: "Record not found" };
    if (error.code === "P2034") return { error: "Request conflict, please retry" };
    return { error: "Database operation failed" };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { error: "Invalid data provided" };
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }

  return { error: "An unexpected error occurred" };
}
