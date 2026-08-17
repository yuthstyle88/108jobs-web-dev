import {useMemo} from "react";
import useSWRMutation from "swr/mutation";
import {callHttp, EMPTY_REQUEST, Payload, REQUEST_STATE, RequestState, WrappedApi108Jobs,} from "@/services/HttpService";
import {useGlobalError} from "@/contexts/GlobalErrorContext";
import {useGlobalLoader} from "@/hooks/ui/GlobalLoaderContext";

/**
 * Imperative HTTP mutation hook (POST / PUT / PATCH / DELETE)
 * with integrated Global Loading and Global Error wiring.
 *
 * @example
 * const { execute, data, isMutating } = useHttpPost("createCategory");
 * await execute({ name: "Design", title: "Design" });
 */
export const useHttpPost = <K extends keyof WrappedApi108Jobs>(method: K) => {
  /** GlobalLoaderContext */
  const { showLoader, hideLoader } = useGlobalLoader();

  /** GlobalErrorContext */
  const {setError} = useGlobalError();

  /** SWR Mutation */
  const {
    trigger, // ฟังก์ชันที่ใช้ยิง API
    data: state = EMPTY_REQUEST, // State ที่ SWR เก็บให้
    isMutating, // กำลัง execute request หรือไม่
  } = useSWRMutation<
    RequestState<Payload<K>>, // ค่า State ที่ SWR เก็บ
    Error, // ประเภท Error
    string, // Key ที่เป็น string
    Parameters<WrappedApi108Jobs[K]> // Argument (Tuple) ที่จะส่งไป
  >(
    `${String(method)}-http-post`, // Use method name as SWR key to avoid collisions
    async(_key, {arg}) => {
      showLoader(); // turn on Global Loader
      setError(null); // clear previous error before new request
      try {
        // Delegate to callHttp
        return await (callHttp(method,
          ...arg) as Promise<
          RequestState<Payload<K>>
        >);
      } catch (e) {
        // setError() runs its argument through t() as an i18n key -- e.message
        // is arbitrary caught-exception text (e.g. "Failed to fetch"), not a
        // key, so passing it directly showed untranslated raw text instead of
        // a real message. "error.serverError" is a real key.
        setError("error.serverError");
        return {
          state: REQUEST_STATE.FAILED,
          err: e instanceof Error ? e : new Error("Unknown error"),
        } as RequestState<Payload<K>>;
      } finally {
        hideLoader(); // turn off Global Loader
      }
    },
    {
      revalidate: false, // no automatic revalidation after mutation
    },
  );

  /** data extracted only when state === SUCCESS */
  const data = useMemo(
    () =>
      state.state === REQUEST_STATE.SUCCESS
        ? (state.data as Payload<K>)
        : null,
    [state],
  );

  /** Execute Function (triggers API) */
  const execute = (...args: Parameters<WrappedApi108Jobs[K]>) => {
    if (args.length === 0) {
      /* trigger without arguments */
      return (trigger as () => Promise<RequestState<Payload<K>>>)();
    }

    /* trigger with arguments (tuple) */
    type TriggerWithArgs = (
      arg: Parameters<WrappedApi108Jobs[K]>,
      options?: unknown
    ) => Promise<RequestState<Payload<K>>>;

    return (trigger as TriggerWithArgs)(args);
  };

  return {
    state, // entire RequestState (empty / loading / failed / success)
    data, // payload only when SUCCESS
    execute, // function to trigger request
    isMutating, // whether a mutation is in-flight
  };
};