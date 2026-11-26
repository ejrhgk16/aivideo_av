import { kstDateTime } from "@/lib/metrics";

/** Upload form values as raw strings, the same on the client (form state) and the server (FormData). */
export type UploadInput = {
  mode: "new" | "existing";
  projectTitle: string;
  companyUuid: string;
  genreId: string;
  description: string;
  posterName: string;
  projectUuid: string;
  episodeNumber: string;
  campaignTitle: string;
  videoName: string;
  durationMs: string;
  price: string;
  releaseAt: string;
};

/** Error keys in form order, so the error summary lists them top to bottom. */
export const UPLOAD_FIELD_LABELS = {
  projectTitle: "프로젝트 제목",
  company: "제작사",
  genre: "장르",
  description: "프로젝트 소개",
  poster: "포스터 이미지",
  project: "프로젝트",
  episodeNumber: "회차 번호",
  campaignTitle: "캠페인 제목",
  video: "영상 파일",
  price: "가격 포인트",
  releaseAt: "공개 예정 일시",
};
export type UploadField = keyof typeof UPLOAD_FIELD_LABELS;
export type UploadErrors = Partial<Record<UploadField, string>>;

export const TITLE_MAX_LENGTH = 150;
// dramas.synopsis is a TEXT column: 65,535 bytes of UTF-8.
const TEXT_MAX_BYTES = 65_535;
// episode_number, duration_ms and price_points are INT columns.
const MAX_INT = 2_147_483_647;

const isInt = (text: string, pattern: RegExp) => pattern.test(text) && Number(text) <= MAX_INT;
/** Length as MySQL VARCHAR counts it: code points, not UTF-16 units. */
const charLength = (text: string) => [...text].length;

/** KST "YYYY-MM-DD HH:mm" to a UTC instant, or null when it is not a real date and time. */
export function parseReleaseAt(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return null;
  const instant = new Date(`${text.replace(" ", "T")}:00+09:00`);
  // Round-trip through KST so impossible dates such as 02-31 or 24:00 are rejected on every engine.
  return Number.isNaN(instant.getTime()) || kstDateTime(instant) !== text ? null : instant;
}

/** existingEpisodeNumbers belong to the chosen project; now is the moment the release time must come after. */
export function validateUpload(input: UploadInput, existingEpisodeNumbers: number[], now: Date): UploadErrors {
  const errors: UploadErrors = {};
  if (input.mode === "new") {
    const title = input.projectTitle.trim();
    if (!title) errors.projectTitle = "프로젝트 제목을 입력해 주세요.";
    else if (charLength(title) > TITLE_MAX_LENGTH) {
      errors.projectTitle = `프로젝트 제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`;
    }
    if (!input.companyUuid) errors.company = "제작사를 선택해 주세요.";
    if (!input.genreId) errors.genre = "장르를 선택해 주세요.";
    if (new TextEncoder().encode(input.description.trim()).length > TEXT_MAX_BYTES) {
      errors.description = "소개는 더 짧게 입력해 주세요.";
    }
    if (!input.posterName) errors.poster = "포스터 이미지를 선택해 주세요.";
  } else if (!input.projectUuid) errors.project = "캠페인을 추가할 프로젝트를 선택해 주세요.";

  if (!isInt(input.episodeNumber, /^[1-9]\d*$/)) errors.episodeNumber = "회차 번호는 1 이상의 숫자로 입력해 주세요.";
  else if (existingEpisodeNumbers.includes(Number(input.episodeNumber))) errors.episodeNumber = "이미 있는 회차 번호예요.";

  const campaignTitle = input.campaignTitle.trim();
  if (!campaignTitle) errors.campaignTitle = "캠페인 제목을 입력해 주세요.";
  else if (charLength(campaignTitle) > TITLE_MAX_LENGTH) {
    errors.campaignTitle = `캠페인 제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  if (!input.videoName) errors.video = "영상 파일을 선택해 주세요.";
  else if (!isInt(input.durationMs, /^[1-9]\d*$/)) errors.video = "영상 길이를 읽지 못했어요. 다른 파일을 선택해 주세요.";

  if (!isInt(input.price, /^\d+$/)) errors.price = "가격은 0 이상의 숫자로 입력해 주세요.";

  const releaseAt = parseReleaseAt(input.releaseAt);
  if (!releaseAt) errors.releaseAt = "공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.";
  else if (releaseAt <= now) errors.releaseAt = "공개 예정 일시는 현재 시각 이후로 입력해 주세요.";
  return errors;
}
