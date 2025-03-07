import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema({
    image: {
        type: String, required: true
    },
    // title: { type: String, required: false },
})

// module.exports = mongoose.model('Banner', bannerSchema)
export default mongoose.model("Banner", bannerSchema);
