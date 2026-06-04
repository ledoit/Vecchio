import { redirect } from "next/navigation";
import { normalizeSessionCode } from "@/lib/session-code";

type Props = {
  params: Promise<{ code: string }>;
};

/** Legacy /s/CODE URLs → /CODE */
export default async function LegacySessionRedirect({ params }: Props) {
  const { code } = await params;
  redirect(`/${normalizeSessionCode(code)}`);
}
