import { OngevalWizardLoader } from "./ongeval-wizard-loader";

export default async function OngevalWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OngevalWizardLoader reportId={id} />;
}
