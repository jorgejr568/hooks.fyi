import { handleIngest } from "./_handle";

async function handle(req: Request, ctx: { params: Promise<{ hookId: string }> }) {
  const { hookId } = await ctx.params;
  return handleIngest(req, hookId, []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
