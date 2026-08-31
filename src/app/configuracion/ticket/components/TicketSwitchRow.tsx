import { Stack, Switch, Typography } from "@mui/material";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** First row in its section skips the top divider. */
  first?: boolean;
}

/** One ticket toggle — label left, switch right, 52px tall, matching `rediseno/ticket-movil.html`. */
export function TicketSwitchRow({
  label,
  checked,
  onChange,
  first = false,
}: Props) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1.75}
      sx={{
        minHeight: 52,
        ...(first ? {} : { borderTop: 1, borderColor: "divider" }),
      }}
    >
      <Typography variant="body2">{label}</Typography>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Stack>
  );
}
