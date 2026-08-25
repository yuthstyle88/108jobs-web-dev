import {useGlobalError} from "@/contexts/GlobalErrorContext"; // Import GlobalError Context
import useSWR, { SWRConfiguration } from "swr";
import {callHttp, EMPTY_REQUEST, Payload, REQUEST_STATE, RequestState, WrappedApi108Heros,} from "@/services/HttpService";
import {UserService} from "@/services";
import {useGlobalLoader} from "@/hooks/ui/GlobalLoaderContext";

const PUBLIC_GET_METHODS = new Set([
  "search",
  "getPost",
  "getPostTags",
  "listCategories",
  "getSite",
  "listBanks",
  "listUserReviews",
  "visitProfile",
]);

export function useHttpGet<K extends keyof WrappedApi108Heros>(
  // ชื่อ request method
  method: K,
  // พารามิเตอร์ที่อาจเป็น args (อาร์เรย์) หรือตัวเลือกเพิ่มเติม (option object)
  argsOrOptions?:
    | Parameters<WrappedApi108Heros[K]>
    | (Parameters<WrappedApi108Heros[K]>[0] & SWRConfiguration<RequestState<Payload<K>>, Error> & { showGlobalLoader?: boolean; isPublic?: boolean }),
  // SWR options
  maybeOptions?: SWRConfiguration<RequestState<Payload<K>>, Error> & { showGlobalLoader?: boolean; isPublic?: boolean },
) {
  const { setLoading } = useGlobalLoader(); // ใช้สำหรับ Global Loader
  const { setError } = useGlobalError(); // ใช้สำหรับ Global Error

  /* ---------- resolve param / options ---------- */
  // เดิม args เป็นอาร์เรย์ แต่ตอนนี้รองรับ Object เพื่อเพิ่มความยืดหยุ่น
  const args = Array.isArray(argsOrOptions)
    ? (argsOrOptions as Parameters<WrappedApi108Heros[K]>)
    : argsOrOptions && typeof argsOrOptions === "object"
    ? [argsOrOptions] // รวม options ไว้ในอาร์เรย์
    : undefined;

  // กำหนดค่าตัวเลือกสำหรับ SWR
  const options = args && Array.isArray(argsOrOptions)
    ? maybeOptions
    : (argsOrOptions as (SWRConfiguration<RequestState<Payload<K>>, Error> & { showGlobalLoader?: boolean; isPublic?: boolean }) | undefined);

  /* ---------- key / fetcher ---------- */
  const key = [method, ...(args ?? [])] as const;

  const showGlobal = Boolean(options?.showGlobalLoader);

  const fetcher = async () => {
    if (showGlobal) setLoading(true); // แสดง Global Loader เฉพาะเมื่อระบุชัดเจน
    setError(null); // ล้างข้อผิดพลาดเก่าก่อนเริ่มการดึงข้อมูลใหม่
    try {
      const typedArgs = (args ?? []) as Parameters<WrappedApi108Heros[K]>;
      return (await callHttp(
        method,
        ...typedArgs,
      )) as RequestState<Payload<K>>;
    } catch (err) {
      // setError() runs its argument through t() as an i18n key -- err.message
      // is arbitrary caught-exception text, not a key; "error.serverError" is
      // a real one.
      setError("error.serverError");
      return {
        state: REQUEST_STATE.FAILED,
        err: err instanceof Error ? err : new Error("Error occurred"),
      } as RequestState<Payload<K>>;
    } finally {
      if (showGlobal) setLoading(false); // ปิด Global Loader
    }
  };

  /* ---------- swr ---------- */
  const isAllowedToFetch = Boolean(
    UserService.Instance?.authInfo?.auth ||
    PUBLIC_GET_METHODS.has(method as string) ||
    options?.isPublic
  );

  const swr = useSWR<RequestState<Payload<K>>, Error>(
    isAllowedToFetch ? key : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      ...options,
    }
  );

  /* ---------- mapping ---------- */
  const state = swr.data ?? EMPTY_REQUEST;
  const data =
    state.state === REQUEST_STATE.SUCCESS ? (state.data as Payload<K>) : null;
  const pagination =
    data && typeof data === "object" && "pagination" in data
      ? (data.pagination as any)
      : undefined;

  const execute = () => swr.mutate();
  const isMutating = swr.isValidating;

  return {
    state,
    data,
    error: swr.error,
    isLoading: swr.isLoading,
    execute,
    isMutating,
    pagination,
  };
}