import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAlertas } from "./useAlertas";
import { alertasMock } from "./pruebas/alertasMock";

afterEach(() => vi.useRealTimers());

it("actualiza las alertas por temporizador y al volver a la ventana", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const fetchMock = vi.fn().mockImplementationOnce(async () => Response.json({ alertas: [] }))
    .mockImplementation(async () => Response.json({ alertas: alertasMock() }));
  vi.stubGlobal("fetch", fetchMock);
  const { result, unmount } = renderHook(() => useAlertas());
  await act(async () => {});
  expect(result.current.alertas).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(result.current.alertas).toHaveLength(5);
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  unmount();
  await vi.advanceTimersByTimeAsync(30000);
  window.dispatchEvent(new Event("focus"));
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("evita consultas superpuestas y cancela al desmontar", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  const { unmount } = renderHook(() => useAlertas());
  await act(async () => { await vi.advanceTimersByTimeAsync(45000); });
  expect(fetchMock).toHaveBeenCalledOnce();
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});

it("espera a terminar la escritura de leída antes de refrescar", async () => {
  let resolvePatch!: (response: Response) => void;
  let leida = false;
  const alerts = alertasMock();
  const id = alerts.find((a) => !a.leida)!.id;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Promise<Response>((resolve) => { resolvePatch = resolve; });
    return Response.json({ alertas: alerts.map((a) => a.id === id ? { ...a, leida } : a) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useAlertas());
  await act(async () => {});
  await act(async () => { result.current.panelMostrado(id); });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.alertas.find((a) => a.id === id)?.leida).toBe(true);
  await act(async () => { leida = true; resolvePatch(Response.json({ leida: true })); });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result.current.alertas.find((a) => a.id === id)?.leida).toBe(true);
});
