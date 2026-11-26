import { Page } from "@/components/ui";
import { requireOperator } from "@/lib/auth";
import { addDays, kstDate, parseRange } from "@/lib/metrics";
import { loadUploadOptions } from "@/lib/upload";
import { UploadForm } from "./UploadForm";

export default async function UploadPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const params = await searchParams;
  const range = parseRange(params.range);
  const options = await loadUploadOptions();
  const preset = options.projects.find((project) => project.uuid === params.projectId)?.uuid;
  const today = kstDate(new Date());

  return (
    <Page title="업로드" breadcrumb={[{ label: "프로젝트 목록", href: `/?range=${range}` }, { label: "업로드" }]} narrow>
      {/* A different ?projectId starts a fresh form. */}
      <UploadForm
        key={preset ?? "new"}
        options={options}
        initialProjectUuid={preset}
        range={range}
        releasePlaceholder={`${addDays(today, 1)} 18:00`}
      />
    </Page>
  );
}
