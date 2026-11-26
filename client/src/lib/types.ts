export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  phone: string;
  bio: string;
  avatarUrl: string;
  status: "active" | "blocked";
  createdAt: string;
};

export type Person = {
  id: string;
  name: string;
  avatarUrl: string;
  createdAt?: string;
  email?: string;
  phone?: string;
};

export type Listing = {
  id: number;
  title: string;
  district: string;
  location: string;
  category: string;
  description: string;
  price: number;
  cleaningFee: number;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minNights: number;
  amenities: string[];
  houseRules: string;
  checkInTime: string;
  checkOutTime: string;
  localNote: string;
  points: number;
  featured: boolean;
  status: "pending" | "approved" | "rejected" | "paused";
  moderationNote: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  photos: { id: number; url: string }[];
  images: string[];
  host: Person;
  rating: number | null;
  reviewCount: number;
};

export type HostListing = Listing & { pendingRequests: number; upcomingStays: number };
export type AdminListing = Listing & { owner: Person; openReports: number };

export type ListingDetail = {
  listing: Listing & {
    host: Person & { bio: string; listingsCount: number; rating: number | null; reviewCount: number };
  };
  bookedRanges: { checkIn: string; checkOut: string }[];
  breakdown: { stars: number; count: number }[];
  viewer: null | {
    isOwner: boolean;
    hasCompletedStay: boolean;
    myReview: { id: number; rating: number; body: string } | null;
  };
};

export type Review = {
  id: number;
  listingId: number;
  listingTitle: string;
  rating: number;
  body: string;
  status: "published" | "hidden";
  verified: boolean;
  hostReply: string;
  hostReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: Person;
};

export type ReservationStatus = "pending" | "confirmed" | "declined" | "cancelled";
export type ReservationStage = ReservationStatus | "upcoming" | "ongoing" | "completed";

export type Reservation = {
  id: number;
  status: ReservationStatus;
  stage: ReservationStage;
  statusNote: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  discount: number;
  total: number;
  points: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  coupon: { code: string; amount: number } | null;
  listing: { id: number; title: string; district: string; image: string; checkInTime: string; checkOutTime: string } | null;
  guest: Person;
  host: Person;
  role: "host" | "guest" | "admin";
  messageCount: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageFromMe: boolean;
  canRespond: boolean;
  canCancel: boolean;
  canReview: boolean;
};

export type Message = { id: number; body: string; createdAt: string; mine: boolean; sender: Person };

export type Coupon = {
  id: number;
  rewardId: number;
  code: string;
  amount: number;
  points: number;
  status: "available" | "used";
  reservationId: number | null;
  createdAt: string;
};

export type PointsSummary = {
  balance: number;
  welcome: number;
  earned: number;
  spent: number;
  pending: number;
  history: { id: string; label: string; points: number; date: string }[];
  coupons: Coupon[];
  rewards: { id: number; points: number; amount: number; title: string; detail: string }[];
};

export type AdminUser = User & { listingsCount: number; tripsCount: number };

export type AdminOverview = {
  users: { total: number; blocked: number; hosts: number };
  listings: { total: number; pending: number; approved: number; rejected: number; paused: number };
  reservations: { total: number; pending: number; confirmed: number; cancelled: number; declined: number };
  reviews: { total: number; hidden: number; average: number | null };
  reports: { open: number };
  database: string;
};

export type Report = {
  id: number;
  reason: string;
  details: string;
  status: "open" | "resolved";
  createdAt: string;
  listing: { id: number; title: string; status: string };
  user: Person;
};

export type RealtimeMessage = { reservationId: number; title: string; message: { id: number; body: string; createdAt: string; sender: Person } };
export type RealtimeReservation = { id: number; status: string; kind: string; from: string; byId?: string; title: string };
