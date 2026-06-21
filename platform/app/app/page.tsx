import { WorkspacePicker } from "@/components/app/workspace-picker"

// Preview route for the app entry (app.heysalad.io). In production the same
// UI is served at "/" on the app subdomain via host-based routing in app/page.tsx.
export default function AppEntryPreview() {
  return <WorkspacePicker />
}
