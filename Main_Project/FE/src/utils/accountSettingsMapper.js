export const splitFullName = (fullName) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { lastName: "", firstName: "" };
  }

  if (parts.length === 1) {
    return { lastName: "", firstName: parts[0] };
  }

  return {
    lastName: parts.slice(0, -1).join(" "),
    firstName: parts[parts.length - 1],
  };
};

export const buildFullName = (lastName, firstName) =>
  `${(lastName || "").trim()} ${(firstName || "").trim()}`.trim();

export const mapUserToAccountForm = (seedUser, authUser) => {
  const merged = {
    ...seedUser,
    ...(authUser || {}),
  };

  const nameParts = splitFullName(merged.full_name || merged.fullName || "");

  return {
    id: merged.id || "",
    lastName: nameParts.lastName,
    firstName: nameParts.firstName,
    labelName: merged.display_name || merged.displayName || merged.email || "",
    email: merged.email || "",
  };
};
