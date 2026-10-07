import { Avatar, Tooltip } from "@heroui/react";

/** The first letters of the first two words: "Laptop (Dan)" is "LD", not "L(". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => /\p{L}|\p{N}/u.exec(word)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase();

/** Where Norless serves a person's photo. */
export const avatarUrl = (avatar: string) => `/api/images/${avatar}`;

/** A person's photo, else their initials, in an avatar. */
export function PersonAvatar({
  name,
  avatar,
  size = "sm",
  className,
}: {
  name: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {avatar && <Avatar.Image src={avatarUrl(avatar)} alt="" />}
      <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
    </Avatar>
  );
}

/** A person's photo or initials in a small avatar, with `label` (e.g. "Added by Ana") on hover. */
export function NameAvatar({
  name,
  label,
  avatar,
}: {
  name: string;
  label: string;
  avatar?: string | null;
}) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger aria-label={label}>
        <PersonAvatar name={name} avatar={avatar} />
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
