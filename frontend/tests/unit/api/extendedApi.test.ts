import { describe, it, expect, vi, beforeEach } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/utils/request", async () => {
  const actual = await vi.importActual<typeof import("../../../src/utils/request")>(
    "../../../src/utils/request",
  );
  return {
    ...actual,
    request: requestMock,
  };
});

import {
  fetchScript,
  createScript,
  updateScript,
  deleteScript,
  cloneScript,
  playScript,
  listScriptVersions,
  publishScript,
  rollbackScript,
  stopScript,
} from "../../../src/api/script";
import {
  createIframeTimeline,
  updateIframeTimeline,
  deleteIframeTimeline,
  cloneIframeTimeline,
  publishIframeTimeline,
  rollbackIframeTimeline,
  listIframeTimelineVersions,
  listIframeTimelines,
  listIframeSnapshots,
  getIframeSnapshot,
  saveIframeSnapshot,
  deleteIframeSnapshot,
} from "../../../src/api/iframe";
import {
  fetchCollageConfig,
  saveCollageConfig,
  uploadScreenshot,
  reportScreenshotFailure,
  generateCollageVersion,
  generateCollageVersionFromNames,
  getCollageProgress,
  listVideoAssets,
} from "../../../src/api/collage";
import {
  fetchSoundFiles,
  fetchSubtitleState,
  fetchCaptionState,
  queueSoundPlay,
  setSubtitle,
  clearSubtitle,
  setCaption,
  clearCaption,
  unlockAudio,
  triggerTts,
  speakWithSubtitle,
} from "../../../src/api/media";
import {
  listScenes,
  deleteScene,
  cloneScene,
  publishScene,
  listSceneVersions,
  rollbackScene,
} from "../../../src/api/scene";
import { fetchKinship, fetchCameraPresets, saveCameraPreset, deleteCameraPreset } from "../../../src/api/system";

describe("api extended coverage", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  describe("scripts", () => {
    it("validates ids and assembles queries", async () => {
      await expect(fetchScript("")).rejects.toThrow("scriptId is required");

      requestMock.mockResolvedValueOnce({ id: "s1" });
      await fetchScript("script 1", { resolve: false, version: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/script%201?resolve=false&version=2",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await createScript({ name: "demo" }, { resolve: false, expectedVersion: 3 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts?resolve=false&expected_version=3",
        expect.objectContaining({ method: "POST", body: { name: "demo" } }),
      );

      await expect(updateScript("", {})).rejects.toThrow("scriptId is required");

      requestMock.mockResolvedValueOnce({ id: "s2" });
      await updateScript("s-2", { ok: true }, { expectedVersion: 7 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-2?expected_version=7",
        expect.objectContaining({ method: "PUT" }),
      );

      await expect(deleteScript("")).rejects.toThrow("scriptId is required");
      requestMock.mockResolvedValueOnce({ ok: true });
      await deleteScript("s-3");
      expect(requestMock).toHaveBeenCalledWith("/api/scripts/s-3", expect.objectContaining({ method: "DELETE" }));

      requestMock.mockResolvedValueOnce({ id: "clone" });
      await cloneScript("s-4", { name: "copy" }, { resolve: false });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-4/clone?resolve=false",
        expect.objectContaining({ method: "POST", body: { name: "copy" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await playScript("s-5", null, { allowDraft: true, version: 9 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-5/play?allow_draft=true&version=9",
        expect.objectContaining({ method: "POST", body: {} }),
      );

      await expect(listScriptVersions("")).rejects.toThrow("scriptId is required");
      requestMock.mockResolvedValueOnce({ versions: [] });
      await listScriptVersions("s-6");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-6/versions",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await publishScript("s-7", { body: true }, { expectedVersion: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-7/publish?expected_version=2",
        expect.objectContaining({ method: "POST", body: { body: true } }),
      );

      await expect(rollbackScript("s-8", {} as any)).rejects.toThrow("rollback payload requires version");

      requestMock.mockResolvedValueOnce({ ok: true });
      await rollbackScript("s-8", { version: 1 }, { expectedVersion: 4 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scripts/s-8/rollback?expected_version=4",
        expect.objectContaining({ method: "POST", body: { version: 1 } }),
      );

      await expect(stopScript("")).rejects.toThrow("scriptId is required");
      requestMock.mockResolvedValueOnce({ ok: true });
      await stopScript("s-9");
      expect(requestMock).toHaveBeenCalledWith("/api/scripts/s-9/stop", expect.objectContaining({ method: "POST" }));
    });
  });

  describe("iframe timelines", () => {
    it("handles creation/update/publish/rollback flows", async () => {
      requestMock.mockResolvedValueOnce({ id: "t1" });
      await createIframeTimeline({ title: "t" }, { resolve: false, expectedVersion: 1 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines?resolve=false&expected_version=1",
        expect.objectContaining({ method: "POST", body: { title: "t" } }),
      );

      requestMock.mockResolvedValueOnce({ id: "t2" });
      await updateIframeTimeline("t-2", { title: "next" }, { resolve: false, expectedVersion: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-2?resolve=false&expected_version=2",
        expect.objectContaining({ method: "PUT", body: { title: "next" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await deleteIframeTimeline("t-3");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-3",
        expect.objectContaining({ method: "DELETE" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await cloneIframeTimeline("t-4", { foo: "bar" }, { resolve: false });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-4/clone?resolve=false",
        expect.objectContaining({ method: "POST", body: { foo: "bar" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await publishIframeTimeline("t-5", { hello: "world" }, { expectedVersion: 3 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-5/publish?expected_version=3",
        expect.objectContaining({ method: "POST", body: { hello: "world" } }),
      );

      await expect(rollbackIframeTimeline("", { version: 1 })).rejects.toThrow("timelineId is required");
      await expect(rollbackIframeTimeline("t-6", {} as any)).rejects.toThrow("rollback payload requires version");

      requestMock.mockResolvedValueOnce({ ok: true });
      await rollbackIframeTimeline("t-6", { version: 2 }, { expectedVersion: 8 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-6/rollback?expected_version=8",
        expect.objectContaining({ method: "POST", body: { version: 2 } }),
      );
    });

    it("lists versions and snapshots with required ids", async () => {
      await expect(listIframeTimelineVersions("")).rejects.toThrow("timelineId is required");
      requestMock.mockResolvedValueOnce({ versions: [] });
      await listIframeTimelineVersions("t-7");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t-7/versions",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ timelines: [] });
      await listIframeTimelines("client-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines?client=client-1",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ snapshots: [] });
      await listIframeSnapshots("c-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-config/snapshots?client=c-1",
        expect.objectContaining({ method: "GET" }),
      );

      await expect(getIframeSnapshot(null, "shot")).rejects.toThrow("clientId is required");
      requestMock.mockResolvedValueOnce({ payload: true });
      await getIframeSnapshot("c-2", "shot-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-config/snapshots/c-2/shot-1",
        expect.objectContaining({ method: "GET" }),
      );

      await expect(saveIframeSnapshot(null, "snap", {})).rejects.toThrow("clientId is required");
      requestMock.mockResolvedValueOnce({ ok: true });
      await saveIframeSnapshot("c-3", "snap", { hello: true });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-config/snapshots/c-3/snap",
        expect.objectContaining({ method: "PUT", body: { hello: true } }),
      );

      await expect(deleteIframeSnapshot(null, "snap")).rejects.toThrow("clientId is required");
      requestMock.mockResolvedValueOnce({ ok: true });
      await deleteIframeSnapshot("c-4", "snap");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-config/snapshots/c-4/snap",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("collage", () => {
    it("fetches/saves configs and uploads screenshots", async () => {
      requestMock.mockResolvedValueOnce({ ok: true });
      await fetchCollageConfig("client-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/collage-config?client=client-1",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await saveCollageConfig({ images: ["a"] });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/collage-config",
        expect.objectContaining({ method: "PUT", body: { images: ["a"] } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      const blob = new Blob(["img"], { type: "image/png" });
      await uploadScreenshot(blob, "req-1", "client-2");
      const uploadCall = requestMock.mock.calls.at(-1);
      expect(uploadCall?.[0]).toBe("/api/screenshots");
      const uploadBody = uploadCall?.[1].body as FormData;
      expect(uploadBody.get("file")).toBeInstanceOf(Blob);
      expect(uploadBody.get("request_id")).toBe("req-1");
      expect(uploadBody.get("client_id")).toBe("client-2");

      requestMock.mockResolvedValueOnce({ ok: true });
      await reportScreenshotFailure("req-err", "boom", "client-3");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/screenshots/req-err/fail",
        expect.objectContaining({ method: "POST", body: { error: "boom", client_id: "client-3" } }),
      );
    });

    it("generates collage versions via files或名稱", async () => {
      const fileA = new File(["a"], "a.png", { type: "image/png" });
      const fileB = new File(["b"], "b.png", { type: "image/png" });
      requestMock.mockResolvedValueOnce({ output_image: "path/to/file.png" });
      const result = await generateCollageVersion([fileA, fileB], { seed: 1 });

      const call = requestMock.mock.calls.at(-1);
      expect(call?.[0]).toBe("/api/generate-collage-version");
      const form = call?.[1].body as FormData;
      expect(form.getAll("files")).toHaveLength(2);
      expect(form.get("params")).toBe(JSON.stringify({ seed: 1 }));
      expect(result.imageUrl).toContain("generated_images");

      requestMock.mockResolvedValueOnce({ ok: true });
      await generateCollageVersionFromNames(["a", "b"], { mix: true });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/generate-collage-version",
        expect.objectContaining({ method: "POST", body: { image_names: ["a", "b"], mix: true } }),
      );

      requestMock.mockResolvedValueOnce({ progress: 10 });
      await getCollageProgress("task#1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/collage-version/task%231/progress",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ assets: [] });
      await listVideoAssets();
      expect(requestMock).toHaveBeenCalledWith(
        "/api/video-assets",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("media", () => {
    it("normalizes sound file urls and audio endpoints", async () => {
      requestMock.mockResolvedValueOnce({
        data: { files: [{ name: "a", url: "/generated images/audio 1.wav" }, { name: "b", url: "http://ext.com/b" }] },
        response: { url: "https://example.com/api/sound-files" },
      });
      const soundResult = await fetchSoundFiles();
      expect(requestMock).toHaveBeenCalledWith(
        "/api/sound-files",
        expect.objectContaining({ returnResponse: true }),
      );
      expect(soundResult.files[0]?.url).toBe("https://example.com/generated%2520images/audio%25201.wav");
      expect(soundResult.files[1]?.url).toBe("http://ext.com/b");

      requestMock.mockResolvedValueOnce({ subtitle: "hello" });
      const subtitle = await fetchSubtitleState("client-1");
      expect(subtitle.subtitle).toBe("hello");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/subtitles?client=client-1",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ caption: "hi" });
      const caption = await fetchCaptionState();
      expect(caption.caption).toBe("hi");

      requestMock.mockResolvedValueOnce({ ok: true });
      await queueSoundPlay("sound.mp3", "client-2");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/sound-play",
        expect.objectContaining({ method: "POST", body: { filename: "sound.mp3", target_client_id: "client-2" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await triggerTts({ text: "hello" });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/tts",
        expect.objectContaining({ method: "POST", body: { text: "hello" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await speakWithSubtitle({ text: "hi" }, { signal: "sig" } as any);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/speak-with-subtitle",
        expect.objectContaining({ method: "POST", body: { text: "hi" }, signal: "sig" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await setSubtitle({ text: "sub" }, "client-3");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/subtitles?target_client_id=client-3",
        expect.objectContaining({ method: "POST", body: { text: "sub" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await clearSubtitle(null);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/subtitles",
        expect.objectContaining({ method: "DELETE" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await setCaption({ text: "cap" }, "client-4");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/captions?target_client_id=client-4",
        expect.objectContaining({ method: "POST", body: { text: "cap" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await clearCaption("client-5");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/captions?target_client_id=client-5",
        expect.objectContaining({ method: "DELETE" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await unlockAudio("client-6");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/unlock-audio?target_client_id=client-6",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("scenes", () => {
    it("covers list/clone/publish/delete/rollback branches", async () => {
      requestMock.mockResolvedValueOnce({ scenes: [] });
      await listScenes({ signal: "sig" } as any);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes",
        expect.objectContaining({ method: "GET", signal: "sig" }),
      );

      await expect(deleteScene("")).rejects.toThrow("sceneId is required");
      requestMock.mockResolvedValueOnce({ ok: true });
      await deleteScene("scene-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-1",
        expect.objectContaining({ method: "DELETE" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await cloneScene("scene-2", { id: "copy" }, { resolve: false });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-2/clone?resolve=false",
        expect.objectContaining({ method: "POST", body: { id: "copy" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await publishScene("scene-3", { p: 1 }, { expectedVersion: 9 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-3/publish?expected_version=9",
        expect.objectContaining({ method: "POST", body: { p: 1 } }),
      );

      await expect(rollbackScene("scene-4", {} as any)).rejects.toThrow("rollback payload requires version");
      requestMock.mockResolvedValueOnce({ ok: true });
      await rollbackScene("scene-4", { version: 1 }, { expectedVersion: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-4/rollback?expected_version=2",
        expect.objectContaining({ method: "POST", body: { version: 1 } }),
      );

      await expect(listSceneVersions("")).rejects.toThrow("sceneId is required");
      requestMock.mockResolvedValueOnce({ versions: [] });
      await listSceneVersions("scene-5");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-5/versions",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("system", () => {
    it("handles kinship and camera preset requests", async () => {
      requestMock.mockResolvedValueOnce({ ok: true });
      await fetchKinship("img123");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/kinship?img=img123&depth=-1",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ presets: [] });
      await fetchCameraPresets({ signal: "sig" } as any);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/camera-presets",
        expect.objectContaining({ method: "GET", signal: "sig" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await saveCameraPreset({ name: "demo" });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/camera-presets",
        expect.objectContaining({ method: "POST", body: { name: "demo" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await deleteCameraPreset("preset 1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/camera-presets/preset%201",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
