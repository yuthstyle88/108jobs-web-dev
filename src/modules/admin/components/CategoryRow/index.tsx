"use client";

import React, {useState} from "react";
import Image from "next/image";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faChevronRight,
    faExpand,
    faImage,
    faPlus,
    faEdit,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {CategoryNodeView, Tag} from "108heros-client";
import {useTranslation} from "react-i18next";
import {toCamelCaseLastSegment} from "@/utils/helpers";

interface CategoryRowProps {
    node: CategoryNodeView;
    depth: number;
    /** Keyed by category id. Built once in the page from `CategoryView.postTags` -- see page.tsx. */
    tagsByCategory: Map<number, Tag[]>;
    onEdit: (node: CategoryNodeView) => void;
    onDelete: (id: number) => void;
    onAddChild: (parentId: number) => void;
    onImageClick: (src: string, alt: string) => void;
    onAddTag: (categoryId: number) => void;
    onEditTag: (tag: Tag) => void;
    onDeleteTag: (tag: Tag) => void;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
                                                            node,
                                                            depth,
                                                            tagsByCategory,
                                                            onEdit,
                                                            onDelete,
                                                            onAddChild,
                                                            onImageClick,
                                                            onAddTag,
                                                            onEditTag,
                                                            onDeleteTag,
                                                        }) => {
    const {t} = useTranslation();
    const [isOpen, setIsOpen] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;
    const tags = tagsByCategory.get(node.category.id) ?? [];

    // Dynamic styling based on depth
    const depthPadding = 2 + depth * 6; // Increases indent with depth
    const isRoot = depth === 0;
    const isChild = depth >= 1;

    return (
        <>
            <tr
                className={`
                    border-b border-gray-200 transition-all duration-200
                    ${isRoot
                    ? "bg-white shadow-sm hover:shadow-md border-l-4 border-l-primary"
                    : isChild
                        ? "bg-gray-50/70 hover:bg-gray-100"
                        : "hover:bg-gray-50"
                }
                    ${depth > 0 ? "text-gray-700" : "font-semibold text-gray-900"}
                `}
                style={{
                    borderLeft: depth > 0 ? `4px solid hsl(${depth * 60}, 70%, 85%)` : undefined
                }}
            >
                {/* Category Preview (Icon + Name + Banner) */}
                <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                        {/* Expand/Collapse Button (only for parents) */}
                        {hasChildren && (
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="text-gray-500 hover:text-primary transition-colors flex-shrink-0"
                            >
                                <FontAwesomeIcon
                                    icon={isOpen ? faChevronDown : faChevronRight}
                                    className="w-5 h-5"
                                />
                            </button>
                        )}
                        {/* Optional spacer for alignment when no chevron */}
                        {!hasChildren && depth > 0 && <div className="w-8"/>}

                        {/* Depth indicator line (visual tree feel) */}
                        {depth > 0 && (
                            <div
                                className="w-8 h-px bg-gray-300 flex-shrink-0"
                                style={{marginLeft: `${depthPadding - 20}px`}}
                            />
                        )}

                        {/* Icon */}
                        <div className="relative group flex-shrink-0">
                            {node.category.icon ? (
                                <Image
                                    src={node.category.icon}
                                    alt={t("admin.category.iconAlt", {name: node.category.title})}
                                    width={56}
                                    height={56}
                                    className={`
                                        rounded-2xl object-cover shadow-md border-2 
                                        ${isRoot ? "border-primary/30" : "border-gray-200"}
                                        hover:border-primary transition-all cursor-pointer
                                        ring-2 ring-transparent hover:ring-primary/20
                                    `}
                                    onClick={() => onImageClick(node.category.icon!, t("admin.category.iconAlt", {name: node.category.title}))}
                                />
                            ) : (
                                <div
                                    className="w-14 h-14 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                                    <FontAwesomeIcon icon={faImage} className="text-gray-400 text-xl"/>
                                </div>
                            )}
                            <div
                                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <FontAwesomeIcon icon={faExpand} className="text-white text-xl"/>
                            </div>
                        </div>

                        {/* Category Name + Banner */}
                        <div className="flex-1 min-w-0">
                            <h3 className={`
                                text-lg font-medium truncate
                                ${isRoot ? "text-primary" : "text-gray-800"}
                            `}>
                                {t(`catalogs.${toCamelCaseLastSegment(node.category.path)}`, {
                                    defaultValue: node.category.title,
                                })}
                            </h3>

                            {/* Banner */}
                            <div className="mt-3">
                                {node.category.banner ? (
                                    <div
                                        className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
                                        onClick={() => onImageClick(node.category.banner!, t("admin.category.bannerAlt", {name: node.category.title}))}
                                    >
                                        <Image
                                            src={node.category.banner}
                                            alt={t("admin.category.bannerAlt", {name: node.category.title})}
                                            width={380}
                                            height={110}
                                            className="w-full h-28 object-cover rounded-xl"
                                        />
                                        <div
                                            className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-xl"/>
                                        <div className="absolute bottom-3 left-4 text-white font-medium text-sm">
                                            {t("admin.category.subcategoryCount", {count: node.children?.length || 0})}
                                        </div>
                                        <div
                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                                            <FontAwesomeIcon icon={faExpand} className="text-white text-3xl"/>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="h-28 bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 text-sm font-medium">
                                        {t("admin.category.noBanner")}
                                    </div>
                                )}
                            </div>

                            {/* Tags */}
                            <div className="mt-3">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                                    {t("admin.category.tags.heading")}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {tags.length === 0 && (
                                        <span className="text-xs text-gray-400 italic">
                                            {t("admin.category.tags.empty")}
                                        </span>
                                    )}
                                    {tags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary"
                                        >
                                            {tag.displayName}
                                            <button
                                                onClick={() => onEditTag(tag)}
                                                className="p-1 rounded-full hover:bg-primary/20 transition-colors"
                                                title={t("admin.category.tags.rename")}
                                                aria-label={t("admin.category.tags.rename")}
                                            >
                                                <FontAwesomeIcon icon={faEdit} className="w-2.5 h-2.5"/>
                                            </button>
                                            <button
                                                onClick={() => onDeleteTag(tag)}
                                                className="p-1 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
                                                title={t("admin.category.tags.delete")}
                                                aria-label={t("admin.category.tags.delete")}
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="w-2.5 h-2.5"/>
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => onAddTag(node.category.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="w-2.5 h-2.5"/>
                                        {t("admin.category.tags.add")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>

                {/* Parent Path */}
                <td className="px-6 py-4 text-sm">
                    <span className={isRoot ? "text-gray-400 italic" : "text-gray-600"}>
                        {isRoot
                            ? t("admin.category.rootLabel")
                            : node.category.path
                                .split(".")
                                .slice(1, -1)
                                .map((segment) => segment.replace(/_/g, " "))
                                .join(" → ") || "-"
                        }
                    </span>
                </td>

                {/* Subcategories Count */}
                <td className="px-6 py-4 text-center">
                    <span className={`
                        inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                        ${hasChildren
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-100 text-gray-500"
                    }
                    `}>
                        {node.children?.length || 0}
                    </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onAddChild(node.category.id)}
                            className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"
                            title={t("admin.category.addChild")}
                            aria-label={t("admin.category.addChild")}
                        >
                            <FontAwesomeIcon icon={faPlus}/>
                        </button>
                        <button
                            onClick={() => onEdit(node)}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                            title={t("admin.category.edit")}
                            aria-label={t("admin.category.edit")}
                        >
                            <FontAwesomeIcon icon={faEdit}/>
                        </button>
                        <button
                            onClick={() => onDelete(node.category.id)}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                            title={t("admin.category.delete")}
                            aria-label={t("admin.category.delete")}
                        >
                            <FontAwesomeIcon icon={faTrash}/>
                        </button>
                    </div>
                </td>
            </tr>

            {/* Recursively render children with clear visual separation */}
            {isOpen &&
                hasChildren &&
                node.children!.map((child) => (
                    <React.Fragment key={child.category.id}>
                        <CategoryRow
                            node={child}
                            depth={depth + 1}
                            tagsByCategory={tagsByCategory}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAddChild={onAddChild}
                            onImageClick={onImageClick}
                            onAddTag={onAddTag}
                            onEditTag={onEditTag}
                            onDeleteTag={onDeleteTag}
                        />
                    </React.Fragment>
                ))}
        </>
    );
};