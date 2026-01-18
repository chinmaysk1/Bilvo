import React, { useState, useRef, useEffect } from "react";

interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface MemberSplit {
  memberId: string;
  value: number;
  included: boolean;
}

interface InteractivePieChartProps {
  members: Member[];
  splits: MemberSplit[];
  onSplitChange: (splits: MemberSplit[]) => void;
  isAdmin: boolean;
  size?: number;
}

export function InteractivePieChart({
  members,
  splits,
  onSplitChange,
  isAdmin,
  size = 120,
}: InteractivePieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [startAngle, setStartAngle] = useState<number>(0);
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size / 2 - 5;
  const innerRadius = outerRadius * 0.64;

  const includedSplits = splits
    .map((split, idx) => ({
      ...split,
      originalIndex: idx,
      member: members.find((m) => m.id === split.memberId),
    }))
    .filter((split) => split.included && split.member);

  const getSliceData = () => {
    let cumulativeAngle = -90;
    return includedSplits.map((split) => {
      const startAngle = cumulativeAngle;
      const sweepAngle = (split.value / 100) * 360;
      const endAngle = startAngle + sweepAngle;
      cumulativeAngle = endAngle;
      return {
        ...split,
        startAngle,
        endAngle,
        sweepAngle,
      };
    });
  };

  const sliceData = getSliceData();

  const polarToCartesian = (angle: number, radius: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    };
  };

  const getSlicePath = (
    startAngle: number,
    endAngle: number,
    outerRadius: number,
    innerRadius: number
  ) => {
    const outerStart = polarToCartesian(startAngle, outerRadius);
    const outerEnd = polarToCartesian(endAngle, outerRadius);
    const innerStart = polarToCartesian(startAngle, innerRadius);
    const innerEnd = polarToCartesian(endAngle, innerRadius);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  };

  const getAngleFromMouse = (event: MouseEvent | React.MouseEvent) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - centerX;
    const y = event.clientY - rect.top - centerY;
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle < -90) angle += 360;
    return angle;
  };

  const handleMouseDown = (event: React.MouseEvent, index: number) => {
    if (!isAdmin) return;
    event.preventDefault();
    setDraggedIndex(index);
    setStartAngle(getAngleFromMouse(event));
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (draggedIndex === null || !isAdmin) return;

      const currentAngle = getAngleFromMouse(event);
      const draggedSlice = sliceData[draggedIndex];
      if (!draggedSlice) return;

      const deltaAngle = currentAngle - startAngle;
      const deltaPercentage = (deltaAngle / 360) * 100;

      const prevIndex = draggedIndex > 0 ? draggedIndex - 1 : null;
      const nextIndex =
        draggedIndex < sliceData.length - 1 ? draggedIndex + 1 : null;

      const newSplits = [...splits];
      const draggedSplitData = sliceData[draggedIndex];

      let newDraggedValue = draggedSplitData.value + deltaPercentage;
      newDraggedValue = Math.round(Math.max(5, Math.min(95, newDraggedValue)));

      const change = newDraggedValue - draggedSplitData.value;

      if (change !== 0) {
        newSplits[draggedSplitData.originalIndex] = {
          ...newSplits[draggedSplitData.originalIndex],
          value: newDraggedValue,
        };

        let adjustIndex: number | null = null;
        if (change > 0) {
          adjustIndex =
            nextIndex !== null ? sliceData[nextIndex].originalIndex : null;
        } else {
          adjustIndex =
            prevIndex !== null ? sliceData[prevIndex].originalIndex : null;
        }

        if (adjustIndex !== null) {
          const currentValue = newSplits[adjustIndex].value;
          const newValue = Math.max(5, currentValue - change);

          if (Math.abs(newValue - currentValue + change) > 0.5) {
            const otherMembers = includedSplits
              .filter((_, idx) => idx !== draggedIndex)
              .map((s) => s.originalIndex);

            if (otherMembers.length > 0) {
              const perMemberChange = -change / otherMembers.length;
              otherMembers.forEach((idx) => {
                newSplits[idx] = {
                  ...newSplits[idx],
                  value: Math.max(1, newSplits[idx].value + perMemberChange),
                };
              });
            }
          } else {
            newSplits[adjustIndex] = {
              ...newSplits[adjustIndex],
              value: newValue,
            };
          }
        } else {
          const otherMembers = includedSplits
            .filter((_, idx) => idx !== draggedIndex)
            .map((s) => s.originalIndex);

          if (otherMembers.length > 0) {
            const perMemberChange = -change / otherMembers.length;
            otherMembers.forEach((idx) => {
              newSplits[idx] = {
                ...newSplits[idx],
                value: Math.max(1, newSplits[idx].value + perMemberChange),
              };
            });
          }
        }

        // normalize to ~100
        const total = newSplits.reduce(
          (sum, s) => sum + (s.included ? s.value : 0),
          0
        );
        if (Math.abs(total - 100) > 0.01) {
          const factor = 100 / total;
          newSplits.forEach((s, idx) => {
            if (s.included) {
              newSplits[idx] = { ...s, value: s.value * factor };
            }
          });
        }

        onSplitChange(newSplits);
        setStartAngle(currentAngle);
      }
    };

    const handleMouseUp = () => setDraggedIndex(null);

    if (draggedIndex !== null) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggedIndex, startAngle, sliceData, splits, onSplitChange, isAdmin]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      className={isAdmin ? "cursor-grab" : "cursor-default"}
      style={{ userSelect: "none" }}
    >
      {sliceData.map((slice, index) => {
        const isHovered = draggedIndex === index;
        const radius = isHovered ? outerRadius + 2 : outerRadius;
        const path = getSlicePath(
          slice.startAngle,
          slice.endAngle,
          radius,
          innerRadius
        );

        return (
          <g key={slice.memberId}>
            <path
              d={path}
              fill={slice.member?.color || "#ccc"}
              opacity={isHovered ? 0.9 : 1}
              stroke="white"
              strokeWidth={2}
              onMouseDown={(e) => handleMouseDown(e, index)}
              className={
                isAdmin
                  ? isHovered
                    ? "cursor-grabbing"
                    : "cursor-grab hover:opacity-90 transition-opacity"
                  : ""
              }
              style={{
                filter: isHovered ? "brightness(1.1)" : "none",
                transition: draggedIndex === null ? "all 0.2s" : "none",
              }}
            />
          </g>
        );
      })}

      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs text-gray-500 pointer-events-none"
        style={{ fontWeight: 600, fontSize: "11px" }}
      >
        {isAdmin ? "Drag to adjust" : "100%"}
      </text>
    </svg>
  );
}
