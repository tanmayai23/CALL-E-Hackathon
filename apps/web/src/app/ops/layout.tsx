import { OpsShell } from "@/components/shell/OpsShell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
