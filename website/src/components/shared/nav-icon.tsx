/**
 * Shared nav icon renderer — resolves icon name strings to MUI icon components.
 * Used by both the Navigation admin manager and the AppShell drawer.
 */
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import TaskIcon from '@mui/icons-material/Task';
import TimelineIcon from '@mui/icons-material/Timeline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StoreIcon from '@mui/icons-material/Store';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import LinkIcon from '@mui/icons-material/Link';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import type { SvgIconProps } from '@mui/material/SvgIcon';

const ICON_MAP: Record<string, React.ComponentType<SvgIconProps>> = {
  Dashboard: DashboardIcon,
  Description: DescriptionIcon,
  Summarize: SummarizeIcon,
  Task: TaskIcon,
  Timeline: TimelineIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  Settings: SettingsIcon,
  Chat: ChatIcon,
  Receipt: ReceiptIcon,
  BarChart: BarChartIcon,
  AccountBalance: AccountBalanceIcon,
  Assessment: AssessmentIcon,
  MenuBook: MenuBookIcon,
  Store: StoreIcon,
  People: PeopleIcon,
  Security: SecurityIcon,
  Link: LinkIcon,
  Home: HomeIcon,
  Explore: ExploreIcon,
  TrendingUp: TrendingUpIcon,
  Analytics: AnalyticsIcon,
  Inventory2: Inventory2Icon,
  CalendarMonth: CalendarMonthIcon,
  Campaign: CampaignIcon,
  Folder: FolderIcon,
  InsertDriveFile: InsertDriveFileIcon,
};

/** All available icon names for use in dropdown selectors. */
export const NAV_ICON_NAMES = Object.keys(ICON_MAP);

/** Render an icon by name, or null if not found / empty. */
export function NavIcon({ name, ...props }: { name: string } & SvgIconProps) {
  if (!name || !ICON_MAP[name]) return null;
  const Icon = ICON_MAP[name];
  return <Icon {...props} />;
}
