import { describe, expect, it } from "vitest";

import { parseReleaseAt, validateUpload, type UploadInput } from "@/lib/uploadValidation";

// 2026-11-23 12:00 KST
const NOW = new Date("2026-11-23T03:00:00Z");

const newProject: UploadInput = {
  mode: "new",
  projectTitle: "마지막 신호",
  companyUuid: "00000001-0000-4000-8000-000000000001",
  genreId: "1",
  description: "",
  posterName: "poster.jpg",
  projectUuid: "",
  episodeNumber: "1",
  campaignTitle: "첫 신호",
  videoName: "ep1.mp4",
  durationMs: "95000",
  price: "0",
  releaseAt: "2026-11-24 18:00",
};

const existingProject: UploadInput = {
  ...newProject,
  mode: "existing",
  projectTitle: "",
  companyUuid: "",
  genreId: "",
  posterName: "",
  projectUuid: "00000002-0000-4000-8000-000000000001",
  episodeNumber: "3",
};

const validate = (changes: Partial<UploadInput>, base = newProject, taken: number[] = []) =>
  validateUpload({ ...base, ...changes }, taken, NOW);

describe("validateUpload", () => {
  it("accepts a valid new project and a valid campaign for an existing project", () => {
    expect(validate({})).toEqual({});
    expect(validate({}, existingProject, [1, 2])).toEqual({});
  });

  it("requires the project fields in new mode", () => {
    expect(validate({ projectTitle: "  ", companyUuid: "", genreId: "", posterName: "" })).toEqual({
      projectTitle: "프로젝트 제목을 입력해 주세요.",
      company: "제작사를 선택해 주세요.",
      genre: "장르를 선택해 주세요.",
      poster: "포스터 이미지를 선택해 주세요.",
    });
  });

  it("requires a project in existing mode and ignores the new-project fields", () => {
    expect(validate({ projectUuid: "" }, existingProject)).toEqual({
      project: "캠페인을 추가할 프로젝트를 선택해 주세요.",
    });
  });

  it("requires the campaign fields in both modes", () => {
    const missing = { campaignTitle: " ", videoName: "", durationMs: "", price: "", releaseAt: "" };
    for (const base of [newProject, existingProject]) {
      expect(Object.keys(validate(missing, base))).toEqual(["campaignTitle", "video", "price", "releaseAt"]);
    }
  });

  it("limits titles to 150 characters, counted by code point", () => {
    expect(validate({ projectTitle: "가".repeat(150), campaignTitle: "😀".repeat(150) })).toEqual({});
    expect(validate({ projectTitle: "가".repeat(151), campaignTitle: "😀".repeat(151) })).toEqual({
      projectTitle: "프로젝트 제목은 150자 이하로 입력해 주세요.",
      campaignTitle: "캠페인 제목은 150자 이하로 입력해 주세요.",
    });
  });

  it("limits the description to what a TEXT column holds, counted in UTF-8 bytes", () => {
    // Each Hangul syllable is 3 bytes: 21,845 fit in 65,535 bytes, 21,846 do not.
    expect(validate({ description: "가".repeat(21_845) })).toEqual({});
    expect(validate({ description: "가".repeat(21_846) })).toEqual({ description: "소개는 더 짧게 입력해 주세요." });
  });

  it("rejects invalid and taken episode numbers", () => {
    for (const episodeNumber of ["", "0", "-1", "01", "1.5", "a", "2147483648"]) {
      expect(validate({ episodeNumber }).episodeNumber).toBe("회차 번호는 1 이상의 숫자로 입력해 주세요.");
    }
    expect(validate({ episodeNumber: "2" }, existingProject, [1, 2]).episodeNumber).toBe("이미 있는 회차 번호예요.");
    expect(validate({ episodeNumber: "2147483647" })).toEqual({});
  });

  it("parses the price as a whole number of points", () => {
    expect(validate({ price: "0" })).toEqual({});
    expect(validate({ price: "300" })).toEqual({});
    for (const price of ["", "-1", "1.5", "1e3", " 5", "2147483648"]) {
      expect(validate({ price }).price).toBe("가격은 0 이상의 숫자로 입력해 주세요.");
    }
  });

  it("asks for another video when its duration could not be read", () => {
    for (const durationMs of ["", "0", "abc"]) {
      expect(validate({ durationMs }).video).toBe("영상 길이를 읽지 못했어요. 다른 파일을 선택해 주세요.");
    }
  });

  it("rejects malformed and impossible release times", () => {
    for (const releaseAt of [
      "2026-11-24",
      "2026-11-24T18:00",
      "2026/11/24 18:00",
      "2026-11-24 18:00:00",
      "2026-02-31 10:00",
      "2027-02-31 10:00",
      "2026-11-24 24:00",
      "2026-13-01 10:00",
      "2026-11-24 18:60",
    ]) {
      expect(validate({ releaseAt }).releaseAt).toBe("공개 예정 일시를 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.");
    }
  });

  it("rejects release times that are not after now", () => {
    for (const releaseAt of ["2026-11-23 12:00", "2026-11-23 11:59", "2025-01-01 00:00"]) {
      expect(validate({ releaseAt }).releaseAt).toBe("공개 예정 일시는 현재 시각 이후로 입력해 주세요.");
    }
    expect(validate({ releaseAt: "2026-11-23 12:01" })).toEqual({});
  });
});

describe("parseReleaseAt", () => {
  it("reads the time as KST", () => {
    expect(parseReleaseAt("2026-11-24 18:00")?.toISOString()).toBe("2026-11-24T09:00:00.000Z");
    expect(parseReleaseAt("2026-01-01 00:30")?.toISOString()).toBe("2025-12-31T15:30:00.000Z");
  });

  it("rejects dates that do not exist", () => {
    expect(parseReleaseAt("2026-02-31 10:00")).toBeNull();
    expect(parseReleaseAt("2026-02-29 10:00")).toBeNull();
    expect(parseReleaseAt("2028-02-29 10:00")?.toISOString()).toBe("2028-02-29T01:00:00.000Z");
    expect(parseReleaseAt("2026-11-24 24:00")).toBeNull();
  });
});
