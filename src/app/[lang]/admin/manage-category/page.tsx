"use client";

import React, {useState, useMemo} from "react";
import {buildCategoriesTree} from "@/utils/helpers";
import {CategoryNodeView} from "108jobs-client";
import {toast} from "sonner";
import {AdminLayout} from "@/modules/admin/components/layout/AdminLayout";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faPlus
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useHttpDelete} from "@/hooks/api/http/useHttpDelete";
import {isFailed, isSuccess} from "@/services/HttpService";
import {CategoryRow} from "@/modules/admin/components/CategoryRow";
import {CategoryModal} from "@/modules/admin/components/Modal/CategoryModal";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";

interface CategoryFormData {
    name: string;
    icon?: string;
    banner?: string;
    description?: string;
    parent_id?: number | null;
}

export default function AdminCategoriesPage() {
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

    // Lightbox
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState("");
    const [lightboxAlt, setLightboxAlt] = useState("");

    const {data: categories, isLoading, state, execute: refetch} = useHttpGet("listCategories");

    const {execute: createCategory} = useHttpPost("createCategory");
    const {execute: deleteCategory} = useHttpDelete("deleteCategory");

    const {execute: uploadIcon} = useHttpPost("uploadCategoryIcon");
    const {execute: uploadBanner} = useHttpPost("uploadCategoryBanner");

    const tree = useMemo<CategoryNodeView[]>(() => {
        if (categories) {
            return buildCategoriesTree(categories) || [];
        }
        return [];
    }, [categories]);

    const openImageLightbox = (src: string, alt: string) => {
        setLightboxSrc(src);
        setLightboxAlt(alt);
        setLightboxOpen(true);
    };

    const handleImageUpload = (type: "icon" | "banner", e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image");
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
            toast.error("Category name is required");
            return;
        }

        let iconUrl = form.icon;
        let bannerUrl = form.banner;

        if (iconMode === "upload" && iconFile && editingCategory) {
            const res = await uploadIcon({id: editingCategory.category.id}, {image: iconFile});
            if (isSuccess(res) && res.data?.images?.[0]?.imageUrl) {
                iconUrl = res.data.images[0].imageUrl;
            } else if (isFailed(res)) {
                toast.error("Some error occurred while uploading the icon. Please try again later.");
            }
        }

        if (bannerMode === "upload" && bannerFile && editingCategory) {
            const res = await uploadBanner({id: editingCategory.category.id}, {image: bannerFile});
            if (isSuccess(res) && res.data?.images?.[0]?.imageUrl) {
                bannerUrl = res.data.images[0].imageUrl;
            } else if (isFailed(res)) {
                toast.error("Some error occurred while uploading the banner. Please try again later.");
            }
        }

        // --- NEW CATEGORY ---
        if (isAddingNew) {
            // CreateCategory has no parent-relationship field (hierarchy is
            // derived server-side from `path`) and requires `title`, which
            // this form doesn't collect separately from `name` -- mirror it
            // until subcategory creation gets a real form/product design.
            const res = await createCategory({
                name: form.name,
                title: form.name,
                description: form.description,
                icon: iconUrl,
                banner: bannerUrl,
            });

            if (isSuccess(res)) {
                toast.success("Category created!");
                closeModal();
            } else if (isFailed(res)) {
                toast.error("Failed to create the category. Please try again.");
            }
            return;
        }

        closeModal();
        await refetch();
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
            name: node.category.name,
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
                            <h1 className="text-2xl font-bold text-primary mb-1">Manage Categories</h1>
                            <p className="text-gray-600">Organize your service catalog structure</p>
                        </div>
                        <div className="relative group inline-block">
                            <button
                                disabled
                                className="inline-flex items-center bg-primary text-white py-3 px-6
                   rounded-xl text-sm font-semibold shadow-md opacity-60
                   cursor-not-allowed"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2"/>
                                Add Root Category
                            </button>

                            <span
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-2
                   bg-black text-white text-xs px-2 py-1 rounded
                   opacity-0 group-hover:opacity-100 transition-opacity">
        Coming soon
    </span>
                        </div>

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
                                    <p className="text-red-600 text-lg">Something went wrong loading categories</p>
                                    <button onClick={() => refetch()}
                                            className="mt-4 text-primary hover:underline">
                                        Try again
                                    </button>
                                </div>
                            ) : tree.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-500 text-lg">No categories found</p>
                                    <button onClick={() => openAddModal(null)}
                                            className="mt-4 text-primary hover:underline">
                                        Create your first category
                                    </button>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subcategories</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {tree.map((root) => (
                                        <CategoryRow
                                            key={root.category.id}
                                            node={root}
                                            depth={0}
                                            onEdit={openEditModal}
                                            onDelete={(id) => deleteCategory({categoryId: id})}
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
                                className="absolute top-4 right-4 bg-white/90 text-black rounded-full w-10 h-10 text-2xl hover:bg-white">
                                ×
                            </button>
                            <p className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                                {lightboxAlt} — Click to close
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}