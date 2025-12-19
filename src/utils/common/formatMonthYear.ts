export const formatMonthYear = (date: Date | null) => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};
