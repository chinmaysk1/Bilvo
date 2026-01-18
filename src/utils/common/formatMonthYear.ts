export const formatMonthYear = (date: Date | null) => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

export const formatMonthDay = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};
