export const dynamic = "force-dynamic";

export default async function LoginLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Record<string, never>>;
}) {
  await params;
  return <>{children}</>;
}
