import Image, {StaticImageData} from "next/image";

interface ChatMessageAvatarProps {
    src: string | StaticImageData;
}

export const ChatMessageAvatar: React.FC<ChatMessageAvatarProps> = ({src}) => (
    <span className="relative mr-2 size-7 shrink-0 self-end overflow-hidden rounded-full sm:mr-3 sm:size-8">
        <Image
            src={src}
            alt="avatar"
            fill
            sizes="(min-width: 640px) 2rem, 1.75rem"
            className="object-cover"
        />
    </span>
);
