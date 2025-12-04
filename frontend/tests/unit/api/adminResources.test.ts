import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../../src/utils/request";

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
  fetchEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  playEpisode,
  cloneEpisode,
  rollbackEpisode,
  listEpisodeVersions,
} from "../../../src/api/episode";
import {
  fetchClientQueue,
  enqueueClientQueueItem,
  cancelClientQueueItems,
  delayClientQueueItems,
  moveClientQueueItems,
} from "../../../src/api/clients";
import {
  fetchIframeTimeline,
  playIframeTimeline,
  stopIframeTimeline,
  listIframeTimelines,
} from "../../../src/api/iframe";
import {
  fetchScene,
  createScene,
  updateScene,
  playScene,
  rollbackScene,
} from "../../../src/api/scene";
import {
  createImageUploadRequest,
  createImageSearchRequest,
  createTextSearchRequest,
  searchImagesByText,
} from "../../../src/api/search";

describe("api/admin resources", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  describe("episodes", () => {
    it("validates required ids and builds queries", async () => {
      await expect(fetchEpisode("", { resolve: false })).rejects.toThrow("episodeId is required");

      requestMock.mockResolvedValueOnce({ id: "ep1" });
      const result = await fetchEpisode("ep 1", { resolve: false, version: 3 });

      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep%201?resolve=false&version=3",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual({ id: "ep1" });
    });

    it("handles mutations and forwards ApiError", async () => {
      requestMock.mockResolvedValueOnce({ id: "new" });
      await createEpisode({ title: "x" }, { resolve: false, expectedVersion: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes?resolve=false&expected_version=2",
        expect.objectContaining({ method: "POST", body: { title: "x" } }),
      );

      requestMock.mockResolvedValueOnce({ id: "updated" });
      await updateEpisode("ep2", { name: "next" }, { expectedVersion: 4 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep2?expected_version=4",
        expect.objectContaining({ method: "PUT" }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await playEpisode("ep3", {}, { allowDraft: true, version: 1 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep3/play?allow_draft=true&version=1",
        expect.objectContaining({ method: "POST", body: {} }),
      );

      requestMock.mockResolvedValueOnce({ id: "clone" });
      await cloneEpisode("ep4", { title: "copy" }, { resolve: false });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep4/clone?resolve=false",
        expect.objectContaining({ method: "POST", body: { title: "copy" } }),
      );

      requestMock.mockResolvedValueOnce({ id: "rb" });
      await rollbackEpisode("ep5", { version: 1 }, { expectedVersion: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep5/rollback?expected_version=2",
        expect.objectContaining({ method: "POST", body: { version: 1 } }),
      );

      requestMock.mockResolvedValueOnce({ versions: [1] });
      await listEpisodeVersions("ep6");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/episodes/ep6/versions",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockRejectedValueOnce(new ApiError(400, "bad", {}, "url"));
      await expect(deleteEpisode("ep7")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("clients", () => {
    it("validates client id and assembles queue queries", async () => {
      await expect(fetchClientQueue("", { status: "pending" })).rejects.toThrow("clientId is required");

      requestMock.mockResolvedValueOnce({ items: [], total: 0 });
      await fetchClientQueue("abc", { status: "pending", page: 2, limit: 10 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/clients/queue?client=abc&page=2&limit=10&status=pending",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("posts queue actions with merged bodies", async () => {
      requestMock.mockResolvedValueOnce({ ok: true });
      await enqueueClientQueueItem({ name: "task" });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/clients/queue",
        expect.objectContaining({ method: "POST", body: { name: "task" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await cancelClientQueueItems(["a", "b"]);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/clients/queue/a/cancel",
        expect.objectContaining({ body: { ids: ["a", "b"] } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await delayClientQueueItems("batch", { deltaSeconds: 3 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/clients/queue/batch/delay",
        expect.objectContaining({ body: { ids: "batch", delta_seconds: 3 } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await moveClientQueueItems(["x", "y"], { priority: 1, position: "after" });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/clients/queue/x/move",
        expect.objectContaining({ body: { ids: ["x", "y"], priority: 1, position: "after" } }),
      );
    });
  });

  describe("iframe timelines", () => {
    it("guards timeline id and passes query params", async () => {
      await expect(fetchIframeTimeline("", { resolve: false })).rejects.toThrow("timelineId is required");

      requestMock.mockResolvedValueOnce({ id: "t1" });
      await fetchIframeTimeline("timeline 1", { resolve: false, version: 5 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/timeline%201?resolve=false&version=5",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ timelines: [] });
      await listIframeTimelines("client-1");
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines?client=client-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("sends play and stop payloads correctly", async () => {
      requestMock.mockResolvedValueOnce({ ok: true });
      await playIframeTimeline("t2", { foo: "bar" }, { targetClientId: "c1", allowDraft: true, version: 9 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/t2/play?target_client_id=c1&allow_draft=true&version=9",
        expect.objectContaining({ method: "POST", body: { foo: "bar" } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      await stopIframeTimeline(null, "timeline-x", { commandId: "cmd" });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/iframe-timelines/stop",
        expect.objectContaining({
          method: "POST",
          body: {
            target_client_id: null,
            timeline_id: "timeline-x",
            command_id: "cmd",
            release_control: true,
          },
        }),
      );
    });
  });

  describe("scenes", () => {
    it("validates scene id and assembles payload", async () => {
      await expect(fetchScene("")).rejects.toThrow("sceneId is required");

      requestMock.mockResolvedValueOnce({ id: "scene-1" });
      await fetchScene("scene-1", { resolve: false, version: 2 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/scene-1?resolve=false&version=2",
        expect.objectContaining({ method: "GET" }),
      );

      requestMock.mockResolvedValueOnce({ id: "snew" });
      await createScene({ name: "new" }, { expectedVersion: 1 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes?expected_version=1",
        expect.objectContaining({ method: "POST", body: { name: "new" } }),
      );

      requestMock.mockResolvedValueOnce({ id: "sup" });
      await updateScene("target", { name: "change" }, { resolve: false });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/target?resolve=false",
        expect.objectContaining({ method: "PUT", body: { name: "change" } }),
      );

      requestMock.mockResolvedValueOnce({ id: "play" });
      await playScene("target", null, { allowDraft: true, version: 7 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/target/play?allow_draft=true&version=7",
        expect.objectContaining({ method: "POST", body: {} }),
      );

      requestMock.mockResolvedValueOnce({ id: "rollback" });
      await rollbackScene("target", { version: 1 }, { expectedVersion: 8 });
      expect(requestMock).toHaveBeenCalledWith(
        "/api/scenes/target/rollback?expected_version=8",
        expect.objectContaining({ method: "POST", body: { version: 1 } }),
      );
    });
  });

  describe("search", () => {
    it("creates upload and search requests with controllers", async () => {
      const fakeBlob = new Blob(["test"], { type: "image/png" });
      requestMock.mockResolvedValueOnce({
        absolute_path: "/tmp/upload.png",
        original_filename: "origin.png",
      });

      const { controller: uploadController, promise } = createImageUploadRequest(fakeBlob);
      const uploadResult = await promise;
      expect(uploadController).toBeInstanceOf(AbortController);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/screenshots",
        expect.objectContaining({ method: "POST" }),
      );
      expect(uploadResult.searchPath).toContain("backend/offspring_images/origin.png");

      requestMock.mockResolvedValueOnce({ ok: true });
      const { controller: imageController, promise: imagePromise } = createImageSearchRequest("img", 5);
      await imagePromise;
      expect(imageController).toBeInstanceOf(AbortController);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/search/image",
        expect.objectContaining({ method: "POST", body: { image_path: "img", top_k: 5 } }),
      );

      requestMock.mockResolvedValueOnce({ ok: true });
      const { controller: textController, promise: textPromise } = createTextSearchRequest("query", 2);
      await textPromise;
      expect(textController).toBeInstanceOf(AbortController);
      expect(requestMock).toHaveBeenCalledWith(
        "/api/search/text",
        expect.objectContaining({ method: "POST", body: { query: "query", top_k: 2 } }),
      );
    });

    it("throws helpful errors when payload is missing", async () => {
      // @ts-expect-error intentionally missing file
      const missing = createImageUploadRequest();
      await expect(missing.promise).rejects.toThrow("請先選擇圖片");

      requestMock.mockRejectedValueOnce(new ApiError(500, "boom", {}, "url"));
      await expect(searchImagesByText("text")).rejects.toBeInstanceOf(ApiError);
    });
  });
});
