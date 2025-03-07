// const deleteImage = require("../config/deleteImage");
// const Banner = require("../models/banner");
// const mongoose = require("mongoose");

import Banner from "../models/banner.js";
import mongoose from "mongoose";


const uploadBanner = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ msg: "No image in the request" });
    const basePath = `${req.protocol}://${req.get("host")}/uploads/`;
    const image = `${basePath}${file.filename}`;
    let banner = new Banner({ image: image });
    banner = await banner.save();
    res.status(200).json({ msg: "banner Upload successFul", banner });
  } catch (error) {
    console.log("uploadBanner Error", error.message);
    res.status(500).json({ msg: "Internal Server Error" });
  }
};

const getBannerImage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const banner = await Banner.find();
    if (!banner) return res.status(404).json({ msg: "data not found" });
    const resultData = banner.slice(startIndex, endIndex);
    const results = {
      totalItems: banner.length,
      currentPage: page,
      totalPages: Math.ceil(banner.length / limit),
      data: resultData,
    };
    res.status(200).json({ msg: "data get successful", results });
  } catch (error) {
    console.log("getBannerImage Error", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

const deleteBanner = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid product ID format" });
    }
    // const banner = await Banner.findById(id)
    // if (!banner) {
    //     return res.status(400).json({
    //         msg: 'the banner with the given Id was not found',
    //     })
    // }
    Banner.findByIdAndDelete(id)
      .then((banner) => {
        if (banner) {
          // deleteImage();
          // console.log("banner image", banner.image);
          return res.status(200).json({
            success: true,
            message: "the Banner is deleted successful",
          });
        } else {
          return res
            .status(404)
            .json({ success: false, message: "Banner not found" });
        }
      })
      .catch((err) => {
        return res.status(400).json({
          message: err.message,
        });
      });
  } catch (error) {
    console.error("deleteBanner Error", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server Error",
    });
  }
};

export { uploadBanner, getBannerImage, deleteBanner };
