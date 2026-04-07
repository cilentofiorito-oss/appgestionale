import { TIME_ZONE } from "@/lib/business-settings";
import { hardDeleteBooking, listBookings } from "@/lib/bookings";

export { TIME_ZONE, listBookings };

export async function deleteBooking(eventId: string) {
  await hardDeleteBooking(eventId);
}
