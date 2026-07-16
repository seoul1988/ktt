<div className="grid grid-cols-2 gap-3">
  <Link href="/admin/owner-requests" className={menuClass}>
    <span>👤 Owner Requests</span>
    <Badge count={ownerRequestCount} />
  </Link>

  <Link href="/admin/owner-business-matching" className={menuClass}>
    <span>🔗 Link Owner</span>
  </Link>

  <Link href="/admin/event-requests" className={menuClass}>
    <span>🎉 Event Requests</span>
    <Badge count={eventRequestCount} />
  </Link>

  <Link href="/admin/coupon-requests" className={menuClass}>
    <span>🎟 Coupon Requests</span>
    <Badge count={couponRequestCount} />
  </Link>

  <Link href="/admin/ads" className={menuClass}>
    <span>📢 Ad Requests</span>
    <Badge count={adRequestCount} />
  </Link>

  <Link href="/admin/businesses" className={menuClass}>
    <span>🏪 Businesses</span>
  </Link>

  <Link href="/admin/categories" className={menuClass}>
    <span>🏷 Categories</span>
  </Link>

  <Link href="/admin/users" className={menuClass}>
    <span>👥 Members</span>
  </Link>

  <Link href="/admin/visitors" className={menuClass}>
    <span>📊 Visitors</span>
  </Link>

  {/* 새 광고관리 버튼 */}
  <Link href="/admin/ad-management" className={menuClass}>
    <span>📰 Ad Management</span>
  </Link>
</div>