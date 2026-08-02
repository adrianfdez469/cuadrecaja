import { Box } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

export const ProductAvatarPlaceholder = () => {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: 2,
        bgcolor: "action.hover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.disabled",
      }}
    >
      <ImageOutlinedIcon fontSize="medium" />
    </Box>
  );
};
