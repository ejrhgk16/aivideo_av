"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/Icon";
import { Field, Panel } from "@/components/ui";
import ui from "@/components/ui.module.css";
import type { UploadOptions } from "@/lib/upload";
import {
  UPLOAD_FIELD_LABELS,
  validateUpload,
  type UploadField,
  type UploadInput,
} from "@/lib/uploadValidation";
import { submitUpload, type UploadState } from "./actions";
import styles from "./upload.module.css";

type Mode = UploadInput["mode"];
type PickedFile = { name: string; size: number };

const emptyForm = {
  projectTitle: "",
  companyUuid: "",
  genreId: "",
  description: "",
  poster: null as PickedFile | null,
  /** null shows the next free number for the chosen project. */
  episodeNumber: null as string | null,
  campaignTitle: "",
  video: null as PickedFile | null,
  durationMs: "",
  cover: null as PickedFile | null,
  price: "0",
  releaseAt: "",
};
type Form = typeof emptyForm;

const formatFileSize = (size: number) =>
  size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

/** Duration in ms as text, or "" when the browser cannot read it. Only the file's metadata is read. */
function readDurationMs(file: File) {
  return new Promise<string>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (durationMs: string) => {
      URL.revokeObjectURL(url);
      resolve(durationMs);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) && video.duration > 0 ? String(Math.round(video.duration * 1000)) : "");
    video.onerror = () => finish("");
    video.src = url;
  });
}

// Stable, so the heading takes focus once when the success view appears and not on later renders.
const focusOnMount = (node: HTMLElement | null) => node?.focus();

function Choice({ name, value, label, checked, onChange }: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`${styles.choice} ${checked ? styles.choiceSelected : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className={styles.choiceInput} />
      {label}
    </label>
  );
}

function FileField({ id, label, accept, required, error, file, onPick }: {
  id: string;
  label: string;
  accept: string;
  required?: boolean;
  error?: string;
  file: PickedFile | null;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} required={required} error={error}>
      <div className={ui.row}>
        {/* No name attribute, so the file itself is never sent. */}
        <input
          ref={input}
          type="file"
          accept={accept}
          hidden
          onChange={(event) => {
            const picked = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (picked) onPick(picked);
          }}
        />
        <button
          type="button"
          aria-describedby={`${id}-file`}
          className={`${ui.button} ${ui.buttonSecondary}`}
          onClick={() => input.current?.click()}
        >
          {label} 선택
        </button>
        <span id={`${id}-file`} className={`${ui.muted} ${styles.fileName}`}>
          {file ? `${file.name} · ${formatFileSize(file.size)}` : "선택한 파일 없음"}
        </span>
      </div>
    </Field>
  );
}

export function UploadForm({ options, initialProjectUuid, range, releasePlaceholder }: {
  options: UploadOptions;
  initialProjectUuid?: string;
  range: number;
  releasePlaceholder: string;
}) {
  const [state, formAction, pending] = useActionState(submitUpload, {});
  // "다시 입력하기" hides the last result without another server round trip.
  const [dismissed, setDismissed] = useState<UploadState | null>(null);
  const [mode, setMode] = useState<Mode>(initialProjectUuid ? "existing" : "new");
  const [projectUuid, setProjectUuid] = useState(initialProjectUuid ?? "");
  const [form, setForm] = useState(emptyForm);
  // Field errors show from the first submit on, judged against the time of the latest submit.
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  // Server errors describe the input that was sent, so they stop showing once a field changes.
  const [sentInput, setSentInput] = useState<string | null>(null);
  const latestVideo = useRef<File | null>(null);

  const project = mode === "existing" ? options.projects.find((item) => item.uuid === projectUuid) : undefined;
  const takenNumbers = project?.episodeNumbers ?? [];
  const episodeNumber = form.episodeNumber ?? String(Math.max(0, ...takenNumbers) + 1);
  const input: UploadInput = {
    mode,
    projectTitle: form.projectTitle,
    companyUuid: form.companyUuid,
    genreId: form.genreId,
    description: form.description,
    posterName: form.poster?.name ?? "",
    projectUuid,
    episodeNumber,
    campaignTitle: form.campaignTitle,
    videoName: form.video?.name ?? "",
    durationMs: form.durationMs,
    price: form.price,
    releaseAt: form.releaseAt,
  };
  const serverErrors = sentInput === JSON.stringify(input) ? state.errors : undefined;
  const errors = { ...serverErrors, ...(checkedAt ? validateUpload(input, takenNumbers, checkedAt) : {}) };
  const errorKeys = (Object.keys(UPLOAD_FIELD_LABELS) as UploadField[]).filter((key) => errors[key]);
  const saved = state === dismissed ? undefined : state.saved;

  const update = (values: Partial<Form>) => setForm((previous) => ({ ...previous, ...values }));

  async function pickVideo(file: File) {
    latestVideo.current = file;
    update({ video: { name: file.name, size: file.size }, durationMs: "" });
    const durationMs = await readDurationMs(file);
    if (latestVideo.current === file) update({ durationMs });
  }

  // Dispatched by hand rather than through <form action>, which would reset the controlled fields afterwards.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date();
    setCheckedAt(now);
    if (Object.keys(validateUpload(input, takenNumbers, now)).length) return;
    setSentInput(JSON.stringify(input));
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function reset() {
    latestVideo.current = null;
    setForm(emptyForm);
    setCheckedAt(null);
    setSentInput(null);
    setDismissed(state);
  }

  if (saved) {
    return (
      <Panel>
        <div className={ui.row}>
          <span className={styles.successIcon}><Icon name="check-circle" size={22} /></span>
          <h2 ref={focusOnMount} tabIndex={-1} className={styles.successTitle}>저장했어요</h2>
        </div>
        <p>{saved.summary}</p>
        <p className={ui.muted}>공개 예정 상태로 저장했어요. 파일은 올리지 않았고, 앱에는 아직 보이지 않아요.</p>
        <div className={ui.row}>
          <Link href={`/projects/${saved.projectUuid}?range=${range}`} className={ui.button}>프로젝트 보기</Link>
          <Link href={`/?range=${range}`} className={`${ui.button} ${ui.buttonSecondary}`}>프로젝트 목록으로</Link>
          <button type="button" className={`${ui.button} ${ui.buttonGhost}`} onClick={reset}>다시 입력하기</button>
        </div>
      </Panel>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <p className={ui.muted}>* 표시는 필수 항목이에요.</p>
      <div role="radiogroup" aria-label="업로드 유형" className={ui.row}>
        <Choice name="mode" value="new" label="새 프로젝트" checked={mode === "new"} onChange={() => setMode("new")} />
        <Choice
          name="mode"
          value="existing"
          label="기존 프로젝트에 캠페인 추가"
          checked={mode === "existing"}
          onChange={() => setMode("existing")}
        />
      </div>

      <Panel title="프로젝트">
        {mode === "new" ? (
          <>
            <Field label="제목" htmlFor="projectTitle" required error={errors.projectTitle}>
              <input
                id="projectTitle"
                name="projectTitle"
                required
                value={form.projectTitle}
                onChange={(event) => update({ projectTitle: event.target.value })}
                placeholder="예: 마지막 신호"
                className={ui.input}
              />
            </Field>
            <Field label="제작사" htmlFor="companyUuid" required error={errors.company}>
              <select
                id="companyUuid"
                name="companyUuid"
                required
                value={form.companyUuid}
                onChange={(event) => update({ companyUuid: event.target.value })}
                className={ui.input}
              >
                <option value="">제작사 선택</option>
                {options.companies.map((company) => (
                  <option key={company.uuid} value={company.uuid}>{company.name}</option>
                ))}
              </select>
            </Field>
            <Field label="장르" required error={errors.genre}>
              <div role="radiogroup" aria-label="장르" aria-required="true" className={ui.row}>
                {options.genres.map((genre) => (
                  <Choice
                    key={genre.id}
                    name="genreId"
                    value={String(genre.id)}
                    label={genre.name}
                    checked={form.genreId === String(genre.id)}
                    onChange={() => update({ genreId: String(genre.id) })}
                  />
                ))}
              </div>
            </Field>
            <Field label="소개" htmlFor="description" error={errors.description}>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
                className={ui.input}
              />
            </Field>
            <FileField
              id="poster"
              label="포스터 이미지"
              accept="image/*"
              required
              error={errors.poster}
              file={form.poster}
              onPick={(file) => update({ poster: { name: file.name, size: file.size } })}
            />
            <input type="hidden" name="posterName" value={form.poster?.name ?? ""} />
          </>
        ) : (
          <Field label="프로젝트" htmlFor="projectUuid" required error={errors.project}>
            <select
              id="projectUuid"
              name="projectUuid"
              required
              value={projectUuid}
              onChange={(event) => {
                setProjectUuid(event.target.value);
                update({ episodeNumber: null });
              }}
              className={ui.input}
            >
              <option value="">프로젝트 선택</option>
              {options.projects.map((item) => (
                <option key={item.uuid} value={item.uuid}>{item.title}</option>
              ))}
            </select>
          </Field>
        )}
      </Panel>

      <Panel title="캠페인">
        <Field label="회차 번호" htmlFor="episodeNumber" required error={errors.episodeNumber}>
          <input
            id="episodeNumber"
            name="episodeNumber"
            inputMode="numeric"
            required
            value={episodeNumber}
            onChange={(event) => update({ episodeNumber: event.target.value })}
            className={ui.input}
          />
        </Field>
        <Field label="캠페인 제목" htmlFor="campaignTitle" required error={errors.campaignTitle}>
          <input
            id="campaignTitle"
            name="campaignTitle"
            required
            value={form.campaignTitle}
            onChange={(event) => update({ campaignTitle: event.target.value })}
            className={ui.input}
          />
        </Field>
        <FileField
          id="video"
          label="영상 파일"
          accept="video/*"
          required
          error={errors.video}
          file={form.video}
          onPick={pickVideo}
        />
        <input type="hidden" name="videoName" value={form.video?.name ?? ""} />
        <input type="hidden" name="durationMs" value={form.durationMs} />
        <FileField
          id="cover"
          label="표지 이미지"
          accept="image/*"
          file={form.cover}
          onPick={(file) => update({ cover: { name: file.name, size: file.size } })}
        />
        <Field label="가격 포인트" htmlFor="price" required error={errors.price} hint="0이면 무료 회차예요.">
          <input
            id="price"
            name="price"
            inputMode="numeric"
            required
            value={form.price}
            onChange={(event) => update({ price: event.target.value })}
            className={ui.input}
          />
        </Field>
        <Field
          label="공개 예정 일시"
          htmlFor="releaseAt"
          required
          error={errors.releaseAt}
          hint="YYYY-MM-DD HH:mm (KST)"
        >
          <input
            id="releaseAt"
            name="releaseAt"
            required
            autoComplete="off"
            value={form.releaseAt}
            onChange={(event) => update({ releaseAt: event.target.value })}
            placeholder={releasePlaceholder}
            className={ui.input}
          />
        </Field>
      </Panel>

      <div className={ui.row}>
        <button type="submit" disabled={pending} className={ui.button}>
          {pending ? "저장하는 중…" : "저장하기"}
        </button>
        <p aria-live="polite" className={styles.errorSummary}>
          {errorKeys.length
            ? `확인이 필요한 항목 ${errorKeys.length}개: ${errorKeys.map((key) => UPLOAD_FIELD_LABELS[key]).join(", ")}`
            : state.message}
        </p>
      </div>
    </form>
  );
}
