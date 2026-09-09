// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import BankAccountPage from "./page";
import {REQUEST_STATE} from "@/services/HttpService";

// Mock เฉพาะ 6 โมดูลตามขอบเขตใบ #157 — HttpService/isFailed ใช้ของจริง
const mockUseHttpGet = vi.fn();
const mockUseHttpPost = vi.fn();
const mockUseHttpPut = vi.fn();
const mockUseHttpDelete = vi.fn();
const mockUseBankAccountsStore = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));
vi.mock("@/hooks/api/http/useHttpPost", () => ({
    useHttpPost: (...args: any[]) => mockUseHttpPost(...args),
}));
vi.mock("@/hooks/api/http/useHttpPut", () => ({
    useHttpPut: (...args: any[]) => mockUseHttpPut(...args),
}));
vi.mock("@/hooks/api/http/useHttpDelete", () => ({
    useHttpDelete: (...args: any[]) => mockUseHttpDelete(...args),
}));
vi.mock("@/store/useBankAccountStore", () => ({
    useBankAccountsStore: (...args: any[]) => mockUseBankAccountsStore(...args),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        // คืนคีย์ตรง ๆ — assertion จึงเทียบคีย์ได้ และจับ literal อังกฤษที่ไม่ผ่าน t() ได้
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

/** บัญชีหนึ่งใบ — bank ใส่เฉพาะเมื่อเซิร์ฟเวอร์ส่งชื่อมา */
const makeAccount = (bankId: number | string, bank?: {name: string}) => ({
    userBankAccount: {
        id: 1,
        bankId,
        accountNumber: "1234567890",
        accountName: "Somchai Jaidee",
        isDefault: false,
        isVerified: true,
    },
    ...(bank ? {bank} : {}),
});

// สถานะ listBanks และคลังบัญชีที่เคสแต่ละเคสกำหนดก่อน render
let bankListData: unknown;
let bankListState: unknown;
let storeAccounts: unknown[];

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("bank-account page — ชื่อธนาคารบนหัวการ์ด (#157)", () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    const renderPage = (): HTMLDivElement => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => {
            root!.render(createElement(BankAccountPage));
        });
        return container;
    };

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        bankListData = undefined;
        bankListState = {state: REQUEST_STATE.SUCCESS};
        storeAccounts = [];

        mockUseHttpGet.mockReset().mockImplementation((endpoint: string) => {
            if (endpoint === "listBanks") {
                return {
                    data: bankListData,
                    isMutating: false,
                    state: bankListState,
                    execute: vi.fn(),
                };
            }
            return {data: undefined, isMutating: false, state: {state: REQUEST_STATE.SUCCESS}, execute: vi.fn()};
        });
        mockUseHttpPost.mockReset().mockReturnValue({execute: vi.fn(), isMutating: false});
        mockUseHttpPut.mockReset().mockReturnValue({execute: vi.fn(), isMutating: false});
        mockUseHttpDelete.mockReset().mockReturnValue({execute: vi.fn(), isMutating: false});
        // mockImplementation (ไม่ใช่ mockReturnValue) เพราะเคสแต่ละเคส
        // กำหนด storeAccounts ใหม่หลัง beforeEach — ต้องอ่านค่าตอน render
        mockUseBankAccountsStore.mockReset().mockImplementation(() => ({
            bankAccounts: storeAccounts,
            setDefaultBankAccount: vi.fn(),
            deleteBankAccount: vi.fn(),
            upsertBankAccount: vi.fn(),
        }));
    });

    afterEach(() => {
        if (root) act(() => root!.unmount());
        container?.remove();
        container = null;
        root = null;
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("เคส 1 — ใช้ชื่อจากเซิร์ฟเวอร์ (acc.bank.name) เมื่อมี แม้ bankList จะบอกชื่ออื่น", () => {
        bankListData = {banks: [{id: 1, name: "WRONG-LIST-NAME", countryId: "TH"}]};
        storeAccounts = [makeAccount(1, {name: "Bangkok Bank"})];
        const host = renderPage();
        expect(host.querySelector("h3")?.textContent).toBe("Bangkok Bank");
    });

    it("เคส 2 — เซิร์ฟเวอร์ไม่ส่งชื่อ ⇒ ไปหาใน bankList ด้วย bankId", () => {
        bankListData = {banks: [{id: 2, name: "Krungthai Bank", countryId: "TH"}]};
        storeAccounts = [makeAccount(2)];
        const host = renderPage();
        expect(host.querySelector("h3")?.textContent).toBe("Krungthai Bank");
    });

    it("เคส 3 — listBanks ล้มเหลว ⇒ บอกว่าโหลดชื่อไม่สำเร็จ (ผ่าน t) ไม่ใช่ literal อังกฤษ", () => {
        bankListData = null;
        bankListState = {state: REQUEST_STATE.FAILED, err: new Error("server error")};
        storeAccounts = [makeAccount(2)];
        const host = renderPage();
        expect(host.querySelector("h3")?.textContent).toBe("sellerBankAccount.bankNameUnavailable");
    });

    it("เคส 4 — โหลด bankList สำเร็จแต่ไม่เจอ bankId ⇒ ไม่ทราบธนาคาร (ผ่าน t) ไม่ใช่ literal อังกฤษ", () => {
        bankListData = {banks: [{id: 5, name: "SCB", countryId: "TH"}]};
        storeAccounts = [makeAccount(2)];
        const host = renderPage();
        expect(host.querySelector("h3")?.textContent).toBe("sellerBankAccount.unknownBank");
    });

    it("เคส 5 — จับคู่ bankId ข้ามชนิด: bankList เก็บเลข บัญชีเก็บสตริง ก็ต้องเจอ", () => {
        bankListData = {banks: [{id: 2, name: "Krungthai Bank", countryId: "TH"}]};
        storeAccounts = [makeAccount("2")];
        const host = renderPage();
        expect(host.querySelector("h3")?.textContent).toBe("Krungthai Bank");
    });

    it("เคส 6 — ไม่มีบัญชีเลย ⇒ ไม่มี h3 และโชว์ข้อความ noBankFound", () => {
        bankListData = {banks: [{id: 2, name: "Krungthai Bank", countryId: "TH"}]};
        storeAccounts = [];
        const host = renderPage();
        expect(host.querySelector("h3")).toBeNull();
        expect(host.textContent).toContain("sellerBankAccount.noBankFound");
    });

    describe("ความล้มเหลวของ \"ลบ\" และ \"ตั้งเป็นบัญชีหลัก\" ต้องมีที่พูดบนหน้า (#163)", () => {
        const failedWith = (err: Record<string, unknown>) => ({state: REQUEST_STATE.FAILED, err});
        const succeeded = () => ({state: REQUEST_STATE.SUCCESS, data: {}});

        // สปายของ store ต้องเป็นตัวเดียวตลอดอายุเคส: mockImplementation ของ harness
        // ด้านบนสร้าง vi.fn() ใหม่ทุกครั้งที่คอมโพเนนต์ re-render จึงนับการเรียกไม่ได้
        let deleteInStore: ReturnType<typeof vi.fn>;
        let setDefaultInStore: ReturnType<typeof vi.fn>;

        const withStableStore = () => {
            deleteInStore = vi.fn();
            setDefaultInStore = vi.fn();
            mockUseBankAccountsStore.mockImplementation(() => ({
                bankAccounts: storeAccounts,
                setDefaultBankAccount: setDefaultInStore,
                deleteBankAccount: deleteInStore,
                upsertBankAccount: vi.fn(),
            }));
        };

        /** useHttpPut ถูกเรียกสองครั้งด้วย endpoint คนละตัว — แยกให้ตรงตัว */
        const withSetDefaultResult = (execute: ReturnType<typeof vi.fn>) => {
            mockUseHttpPut.mockImplementation((endpoint: string) =>
                endpoint === "setDefaultBankAccount"
                    ? {execute, isMutating: false}
                    : {execute: vi.fn(), isMutating: false});
        };

        const buttonIn = (root: ParentNode, text: string) =>
            Array.from(root.querySelectorAll("button")).find(b => (b.textContent ?? "").includes(text));

        const errorBanner = (host: HTMLDivElement) => host.querySelector("[data-testid=\"bank-action-error\"]");

        /** กดปุ่มลบบนการ์ด แล้วกดยืนยันในกล่อง (กล่องเป็น portal อยู่นอก container) */
        const deleteAndConfirm = async (host: HTMLDivElement) => {
            await act(async () => {
                buttonIn(host, "global.buttonDelete")!.click();
            });
            const dialog = document.querySelector("[role=\"dialog\"]")!;
            await act(async () => {
                buttonIn(dialog, "Delete")!.click();
            });
        };

        beforeEach(() => {
            bankListData = {banks: [{id: 1, name: "Bangkok Bank", countryId: "TH"}]};
            storeAccounts = [makeAccount(1, {name: "Bangkok Bank"})];
            withStableStore();
        });

        it("เคส 7 — ลบไม่สำเร็จ ⇒ ขึ้นข้อความบนหน้า และไม่แตะ store", async () => {
            mockUseHttpDelete.mockReturnValue({
                execute: vi.fn().mockResolvedValue(failedWith({status: 500})),
                isMutating: false,
            });
            const host = renderPage();
            await deleteAndConfirm(host);

            expect(errorBanner(host)?.textContent).toBe("error.serverError");
            expect(deleteInStore).toHaveBeenCalledTimes(0);
        });

        it("เคส 8 — ลบสำเร็จ ⇒ ไม่มีข้อความ และ store ถูกเรียกด้วย id ที่ถูก", async () => {
            mockUseHttpDelete.mockReturnValue({
                execute: vi.fn().mockResolvedValue(succeeded()),
                isMutating: false,
            });
            const host = renderPage();
            await deleteAndConfirm(host);

            expect(errorBanner(host)).toBeNull();
            expect(deleteInStore).toHaveBeenCalledTimes(1);
            expect(deleteInStore).toHaveBeenCalledWith(1);
        });

        it("เคส 9 — ข้อความของ 'ลบไม่สำเร็จ' ต้องไม่ไปโผล่ในกล่องเพิ่มบัญชี", async () => {
            mockUseHttpDelete.mockReturnValue({
                execute: vi.fn().mockResolvedValue(failedWith({status: 500})),
                isMutating: false,
            });
            const host = renderPage();
            await deleteAndConfirm(host);
            expect(errorBanner(host)?.textContent).toBe("error.serverError");

            await act(async () => {
                buttonIn(host, "sellerBankAccount.buttonAddBank")!.click();
            });
            // กล่องที่มีฟอร์ม = กล่องเพิ่ม/แก้บัญชี (กล่องยืนยันลบไม่มีฟอร์ม)
            const addBox = Array.from(document.querySelectorAll("[role=\"dialog\"]"))
                .find(d => d.querySelector("form"));
            expect(addBox).toBeTruthy();
            expect(addBox!.textContent).not.toContain("error.serverError");
        });

        it("เคส 10 — ตั้งเป็นบัญชีหลักไม่สำเร็จ ⇒ ขึ้นข้อความบนหน้า และไม่แตะ store", async () => {
            withSetDefaultResult(vi.fn().mockResolvedValue(failedWith({status: 500})));
            const host = renderPage();
            await act(async () => {
                buttonIn(host, "sellerBankAccount.setAsDefault")!.click();
            });

            expect(errorBanner(host)?.textContent).toBe("error.serverError");
            expect(setDefaultInStore).toHaveBeenCalledTimes(0);
        });

        it("เคส 11 — ตั้งเป็นบัญชีหลักสำเร็จ ⇒ ไม่มีข้อความ", async () => {
            withSetDefaultResult(vi.fn().mockResolvedValue(succeeded()));
            const host = renderPage();
            await act(async () => {
                buttonIn(host, "sellerBankAccount.setAsDefault")!.click();
            });

            expect(errorBanner(host)).toBeNull();
            expect(setDefaultInStore).toHaveBeenCalledWith(1);
        });

        it("เคส 12 — บัญชียังไม่ verified ⇒ ไม่มีปุ่มตั้งเป็นหลัก และไม่มีข้อความผิดพลาด", () => {
            const unverified = makeAccount(1, {name: "Bangkok Bank"});
            unverified.userBankAccount.isVerified = false;
            storeAccounts = [unverified];
            const host = renderPage();

            expect(buttonIn(host, "sellerBankAccount.setAsDefault")).toBeUndefined();
            expect(errorBanner(host)).toBeNull();
        });

        it("เคส 13 — ข้อความเก่าหายเมื่อการกระทำถัดไปสำเร็จ", async () => {
            const setDefaultExec = vi.fn()
                .mockResolvedValueOnce(failedWith({status: 500}))
                .mockResolvedValueOnce(succeeded());
            withSetDefaultResult(setDefaultExec);
            const host = renderPage();

            await act(async () => {
                buttonIn(host, "sellerBankAccount.setAsDefault")!.click();
            });
            expect(errorBanner(host)?.textContent).toBe("error.serverError");

            await act(async () => {
                buttonIn(host, "sellerBankAccount.setAsDefault")!.click();
            });
            expect(errorBanner(host)).toBeNull();
        });

        it("เคส 14 — ข้อความมาจาก t() ไม่ใช่ literal อังกฤษที่พิมพ์ในไฟล์", async () => {
            withSetDefaultResult(vi.fn().mockResolvedValue(failedWith({status: 500, error: "bankInUse"})));
            const host = renderPage();
            await act(async () => {
                buttonIn(host, "sellerBankAccount.setAsDefault")!.click();
            });

            expect(errorBanner(host)?.textContent).toBe("error.serverError (bankInUse)");
        });
    });
});
