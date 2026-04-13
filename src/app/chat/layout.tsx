export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Record<string, never>>;
}) {
  await params;
  return <>{children}</>;
}
