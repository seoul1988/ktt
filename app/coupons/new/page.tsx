"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function NewCouponPage() {

  const [businesses,setBusinesses]=
    useState<any[]>([]);

  const [businessId,setBusinessId]=
    useState("");

  const [title,setTitle]=
    useState("");

  const [description,setDescription]=
    useState("");

  const [couponType,setCouponType]=
    useState("percent");

  const [value,setValue]=
    useState(10);

  useEffect(()=>{

    loadBusinesses();

  },[]);

  async function loadBusinesses(){

    const {
      data:{user},
    }=
    await supabase.auth.getUser();

    if(!user)return;

    const {data}=await supabase
      .from("businesses")
      .select("id,name")
      .eq(
        "owner_id",
        user.id
      );

    setBusinesses(
      data||[]
    );

    if(data?.length){
      setBusinessId(
        data[0].id
      );
    }

  }

  async function createCoupon(){

    const {error}=await supabase
      .from("coupons")
      .insert({

        business_id:
          businessId,

        title,

        description,

        coupon_type:
          couponType,

        value,

        active:true

      });

    if(error){

      alert(
        error.message
      );

      return;
    }

    alert(
      "쿠폰 등록 완료"
    );

    location.href="/";

  }

  return (

<div
className="
max-w-md
mx-auto
p-5
"
>

<h1
className="
text-2xl
font-bold
mb-6
"
>

Register Coupon

</h1>

<select
value={businessId}
onChange={(e)=>
setBusinessId(
e.target.value
)}
className="
w-full
border
rounded
p-3
mb-3
"
>

{businesses.map(
(b)=>(

<option
key={b.id}
value={b.id}
>

{b.name}

</option>

))}

</select>

<input
placeholder="Title"
value={title}
onChange={(e)=>
setTitle(
e.target.value
)}
className="
w-full
border
rounded
p-3
mb-3
"
/>

<textarea
placeholder="Description"
value={description}
onChange={(e)=>
setDescription(
e.target.value
)}
className="
w-full
border
rounded
p-3
mb-3
"
/>

<select
value={couponType}
onChange={(e)=>
setCouponType(
e.target.value
)}
className="
w-full
border
rounded
p-3
mb-3
"
>

<option value="percent">
Percent
</option>

<option value="fixed">
Amount
</option>

<option value="free">
Free
</option>

</select>

<input
type="number"
value={value}
onChange={(e)=>
setValue(
Number(
e.target.value
)
)}
className="
w-full
border
rounded
p-3
mb-4
"
/>

<button
onClick={
createCoupon
}
className="
w-full
bg-red-500
text-white
rounded
p-3
"
>

등록하기

</button>

</div>

);

}