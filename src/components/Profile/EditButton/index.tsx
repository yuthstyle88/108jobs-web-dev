import Link from "next/link";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faEdit} from "@fortawesome/free-solid-svg-icons";
import React from "react";

interface EditButtonProps {
    href: string;
    label: string;
}

const EditButton: React.FC<EditButtonProps> = ({href, label}) => (
    <Link
        prefetch={false}
        href={href}
        className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
        aria-label={label}
    >
        <FontAwesomeIcon icon={faEdit} className="text-gray-600"/>
    </Link>
);

export default EditButton;
