"use client";

import React, {useState, useMemo, useEffect} from "react";
import {buildCategoriesTree} from "@/utils/helpers";
import {CategoryNodeView} from "108jobs-client";
import {toast} from "sonner";
import {useTranslation} from "react-i18next";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faPlus
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpPut} from "@/hooks/api/http/useHttpPut";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
import {isFailed, isSuccess} from "@/services/HttpService";
import {CategoryRow} from "@/modules/admin/components/CategoryRow";
import {CategoryModal} from "@/modules/admin/components/Modal/CategoryModal";
import {DeleteCategoryModal} from "@/modules/admin/components/Modal/DeleteCategoryModal";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";

interface CategoryFormData {
    name: string;
    icon?: string;
    banner?: string;
    description?: string;
    parent_id?: number | null;
}

/** Depth-first lookup by id; the page only ever holds the tree, not a flat list. */
function findNodeById(nodes: CategoryNodeView[], id: number): CategoryNodeView | null {
    for (const node of nodes) {
        if (node.category.id === id) return node;
        const found = findNodeById(node.children || [], id);
        if (found) return found;
    }
    return null;
}

export default function AdminCategoriesPage() {
    const {t} = useTranslation();
    const [editingCategory, setEditingCategory] = useState<CategoryNodeView | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [parentIdForNew, setParentIdForNew] = useState<number | null>(null);
    const [form, setForm] = useState<CategoryFormData>({
        name: "",
        icon: "",
        banner: "",
        description: "",
        parent_id: null
    });
    const [iconMode, setIconMode] = useState<"url" | "upload">("url");
    const [bannerMode, setBannerMode] = useState<"url" | "upload">("url");
    const [uploadedIcon, setUploadedIcon] = useState<string | null>(null);
    const [uploadedBanner, setUploadedBanner] = useState<string | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<CategoryNodeView | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Lightbox
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState("");
    const [lightboxAlt, setLightboxAlt] = useState("");

    const {data: categories, isLoading, state, execute: refetch} = useHttpGet("listCategories");

    const {execute: createCategory} = useHttpPost("createCategory");
    const {execute: editCategory} = useHttpPut("editCategory");
    const {execute: deleteCategory} = useHttpDelete("deleteCategory");

    const {execute: uploadIcon} = useHttpPost("uploadCategoryIcon");
    const {execute: uploadBanner} = useHttpPost("uploadCategoryBanner");

    const tree = useMemo<CategoryNodeView[]>(() => {
        if (!categories) return [];
        // The list endpoint returns soft-deleted categories to admins (they
        // bypass the hide filter every other caller gets), so without this a
        // just-deleted category stays on screen behind its own success toast.
        const prune = (nodes: CategoryNodeView[]): CategoryNodeView[] =>
            nodes
                .filter((node) => !node.category.deleted)
                .map((node) => ({...node, children: prune(node.children || [])}));
        return prune(buildCategoriesTree(categories) || []);
    }, [categories]);

    const openImageLightbox = (src: string, alt: string) => {
        setLightboxSrc(src);
        setLightboxAlt(alt);
        setLightboxOpen(true);
    };

    useEffect(() => {
        if (!lightboxOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setLightboxOpen(false);
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [lightboxOpen]);

    const handleImageUpload = (type: "icon" | "banner", e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error(t("admin.category.imageTooLarge"));
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error(t("admin.category.invalidImageType"));
            return;
        }

        // preview
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;

            if (type === "icon") {
                setUploadedIcon(result);
                setForm({...form, icon: result});
                setIconFile(file); // ⭐ add this
                setIconMode("upload");
            } else {
                setUploadedBanner(result);
                setForm({...form, banner: result});
                setBannerFile(file); // ⭐ add this
                setBannerMode("upload");
            }

        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error(t("admin.category.nameRequired"));
            return;
        }

        let iconUrl = form.icon;
        let bannerUrl = form.banner;

        if (iconMode === "upload" && iconFile && editingCategory) {
            const res = await uploadIcon({id: editingCategory.category.id}, {image: iconFile});
            if (isSuccess(res) && res.data?.images?.[0]?.imageUrl) {
                iconUrl = res.data.images[0].imageUrl;
            } else if (isFailed(res)) {
                toast.error(t("admin.category.iconUploadError"));
            }
        }

        if (bannerMode === "upload" && bannerFile && editingCategory) {
            const res = await uploadBanner({id: editingCategory.category.id}, {image: bannerFile});
            if (isSuccess(res) && res.data?.images?.[0]?.imageUrl) {
                bannerUrl = res.data.images[0].imageUrl;
            } else if (isFailed(res)) {
                toast.error(t("admin.category.bannerUploadError"));
            }
        }

        // --- NEW CATEGORY ---
        if (isAddingNew) {
            // `title` isn't collected separately from `name` by this form, so
            // it mirrors it. The backend derives the ltree path from `name`
            // plus the parent's path.
            const res = await createCategory({
                name: form.name,
                title: form.name,
                parentId: parentIdForNew ?? undefined,
                description: form.description,
                // On the upload tab `iconUrl` still holds the FileReader's
                // base64 data: URL from the preview -- only a real URL from
                // the URL tab belongs in the create payload. The empty-string
                // fallback has to become `undefined`: the field deserializes
                // as a URL server-side, and `""` fails at the extractor with
                // a 400 that never reaches the CORS layer, so the browser
                // reports an opaque network error instead.
                icon: iconMode === "url" && iconUrl ? iconUrl : undefined,
                banner: bannerMode === "url" && bannerUrl ? bannerUrl : undefined,
            });

            if (isSuccess(res)) {
                // Images can only be uploaded against an existing id, so any
                // pending files are sent once the category exists.
                const newId = res.data?.categoryView?.category?.id;
                if (newId !== undefined) {
                    if (iconMode === "upload" && iconFile) {
                        await uploadIcon({id: newId}, {image: iconFile});
                    }
                    if (bannerMode === "upload" && bannerFile) {
                        await uploadBanner({id: newId}, {image: bannerFile});
                    }
                }
                toast.success(t("admin.category.created"));
                closeModal();
                await refetch();
            } else if (isFailed(res)) {
                toast.error(t("admin.category.createError"));
            }
            return;
        }

        if (editingCategory) {
            const res = await editCategory({
                categoryId: editingCategory.category.id,
                name: form.name,
                title: form.name,
                description: form.description,
                icon: iconUrl || undefined,
                banner: bannerUrl || undefined,
            });

            if (isFailed(res)) {
                toast.error(t("admin.category.saveError"));
                return;
            }
        }

        closeModal();
        await refetch();
    };

    const handleConfirmDelete = async () => {
        if (!deletingCategory) return;
        setIsDeleting(true);
        const res = await deleteCategory({
            categoryId: deletingCategory.category.id,
            deleted: true,
        });
        setIsDeleting(false);

        if (isSuccess(res)) {
            toast.success(t("admin.category.deleted"));
            setDeletingCategory(null);
            await refetch();
        } else if (isFailed(res)) {
            // The backend refuses to delete a category that still has live
            // subcategories rather than orphaning them. Leave the dialog open
            // so the message sits next to the category it refers to.
            toast.error(
                res.err?.error === "categoryHasChildren"
                    ? t("admin.category.deleteHasChildren")
                    : t("admin.category.deleteError"),
            );
        }
    };

    const closeModal = () => {
        setIsAddingNew(false);
        setEditingCategory(null);
        setForm({name: "", icon: "", banner: "", description: "", parent_id: null});
        setUploadedIcon(null);
        setUploadedBanner(null);
        setIconMode("url");
        setBannerMode("url");
        setIconFile(null);
        setBannerFile(null);
    };

    const openAddModal = (parentId: number | null = null) => {
        setParentIdForNew(parentId);
        closeModal();
        setIsAddingNew(true);
    };

    const openEditModal = (node: CategoryNodeView) => {
        setEditingCategory(node);
        setForm({
            name: node.category.title,
            icon: node.category.icon || "",
            banner: node.category.banner || "",
            description: node.category.description || "",
            parent_id: null,
        });
        setUploadedIcon(node.category.icon || null);
        setUploadedBanner(node.category.banner || null);
        setIconMode(node.category.icon?.startsWith("http") ? "url" : "upload");
        setBannerMode(node.category.banner?.startsWith("http") ? "url" : "upload");
    };

    const isModalOpen = isAddingNew || !!editingCategory;

    return (
        <AdminLayout>
            <div className="bg-[#F6F9FE] text-gray-600 min-h-screen">
                <div className="max-w-[1400px] mx-auto py-8 px-4 md:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-primary mb-1">{t("admin.category.title")}</h1>
                            <p className="text-gray-600">{t("admin.category.subtitle")}</p>
                        </div>
                        <button
                            onClick={() => openAddModal(null)}
                            className="inline-flex items-center bg-primary text-white py-3 px-6
                   rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2"/>
                            {t("admin.category.addRoot")}
                        </button>

                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-borderPrimary overflow-hidden">
                        <div className="overflow-x-auto">
                            {isLoading ? (
                                <div className="py-16 text-center">
                                    <div
                                        className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : isFailed(state) ? (
                                <div className="text-center py-16">
                                    <p className="text-red-600 text-lg">{t("admin.category.loadError")}</p>
                                    <button onClick={() => refetch()}
                                            className="mt-4 text-primary hover:underline">
                                        {t("admin.category.retry")}
                                    </button>
                                </div>
                            ) : tree.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-500 text-lg">{t("admin.category.empty")}</p>
                                    <button onClick={() => openAddModal(null)}
                                            className="mt-4 text-primary hover:underline">
                                        {t("admin.category.createFirst")}
                                    </button>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("admin.category.columnCategory")}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("admin.category.columnParent")}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("admin.category.columnSubcategories")}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("admin.category.columnActions")}</th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {tree.map((root) => (
                                        <CategoryRow
                                            key={root.category.id}
                                            node={root}
                                            depth={0}
                                            onEdit={openEditModal}
                                            onDelete={(id) => setDeletingCategory(findNodeById(tree, id))}
                                            onAddChild={openAddModal}
                                            onImageClick={openImageLightbox}
                                        />
                                    ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>

                {/* Edit/Add Modal */}
                <CategoryModal
                    isOpen={isModalOpen}
                    isAddingNew={isAddingNew}
                    parentName={
                        parentIdForNew !== null
                            ? findNodeById(tree, parentIdForNew)?.category.title ?? null
                            : null
                    }
                    form={form}
                    setForm={setForm}
                    iconMode={iconMode}
                    setIconMode={setIconMode}
                    bannerMode={bannerMode}
                    setBannerMode={setBannerMode}
                    uploadedIcon={uploadedIcon}
                    setUploadedIcon={setUploadedIcon}
                    uploadedBanner={uploadedBanner}
                    setUploadedBanner={setUploadedBanner}
                    onImageUpload={handleImageUpload}
                    onSave={handleSave}
                    onClose={closeModal}
                />

                <DeleteCategoryModal
                    isOpen={!!deletingCategory}
                    categoryName={deletingCategory?.category.title ?? ""}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeletingCategory(null)}
                    isLoading={isDeleting}
                />

                {/* Lightbox */}
                {lightboxOpen && (
                    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-8"
                         onClick={() => setLightboxOpen(false)}>
                        <div className="relative max-w-5xl max-h-full">
                            <Image
                                src={lightboxSrc}
                                alt={lightboxAlt}
                                width={1200}
                                height={800}
                                className="max-w-full max-h-full object-contain"
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxOpen(false);
                                }}
                                aria-label={t("admin.category.lightboxCloseLabel")}
                                className="absolute top-4 right-4 bg-white/90 text-black rounded-full w-10 h-10 text-2xl hover:bg-white">
                                ×
                            </button>
                            <p className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                                {t("admin.category.lightboxCaption", {name: lightboxAlt})}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}