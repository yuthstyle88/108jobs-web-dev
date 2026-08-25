import {useMemo} from "react";
import useSWRMutation from "swr/mutation";
import {callHttp, EMPTY_REQUEST, Payload, REQUEST_STATE, RequestState, WrappedApi108Heros,} from "@/services/HttpService";
import {useGlobalError} from "@/contexts/GlobalErrorContext";
import {useGlobalLoader} from "@/hooks/ui/GlobalLoaderContext";

export const useHttpPut = <K extends keyof WrappedApi108Heros>(method: K) => {
  const { setLoading } = useGlobalLoader();
  const { setError } = useGlobalError();

  const {
    trigger,
    data: state = EMPTY_REQUEST,
    isMutating,
  } = useSWRMutation<
    RequestState<Payload<K>>,
    Error,
    string,
    Parameters<WrappedApi108Heros[K]>
  >(
    `${String(method)}-http-put`,
    async (_key, { arg }) => {
      setLoading(true);
      setError(null);
      try {
        return await callHttp(method, ...arg) as RequestState<Payload<K>>;
      } catch (e) {
        // setError() runs its argument through t() as an i18n key -- e.message
        // is arbitrary caught-exception text, not a key; "error.serverError"
        // is a real one.
        setError("error.serverError");
        return {
          state: REQUEST_STATE.FAILED,
          err: e instanceof Error ? e : new Error("Unknown error"),
        };
      } finally {
        setLoading(false);
      }
    },
    { revalidate: false }
  );

  const data = useMemo(
    () => (state.state === REQUEST_STATE.SUCCESS ? state.data as Payload<K> : null),
    [state]
  );

  const execute = (...args: Parameters<WrappedApi108Heros[K]>) => {
    if (args.length === 0) {
        return (trigger as () => Promise<RequestState<Payload<K>>>)();
    }
    return (trigger as (arg: Parameters<WrappedApi108Heros[K]>) => Promise<RequestState<Payload<K>>>)(args);
  };

  return { state, data, execute, isMutating };
};
